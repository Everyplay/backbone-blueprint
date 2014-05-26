var should = require('chai').should();
var BaseModel = require('..').Model;
var BaseCollection = require('..').Collection;
var SchemaFactory = require('..').SchemaFactory;
var util = require('util');

var schema1 = {
  id: 'schemas/foo1',
  type: 'object',
  properties: {
    id: {
      type: 'number'
    },
    name: {
      type: 'string',
      required: true
    },
    enabled: {
      type: 'boolean',
      default: false
    },
    created_at: {
      type: 'date',
      default: 'now'
    },
    foo2_id: {
      type: 'number',
      conversion: 'id'
    },
    coll_id: {
      type: 'number'
    },
    bar: {
      type: 'object',
      $ref: 'schemas/foo2',
      references: {
        id: 'foo2_id',
        parent_id: 'id'
      },
      roles: ['owner'],
      mount: true,
      name: 'bars'
    },
    dyn: {
      type: 'object',
      $ref: 'schemas/foo3',
      references: {
        id: 'foo2_id'
      }
    },
    coll: {
      type: 'array',
      $ref: 'schemas/foo3',
      default: [],
      references: {
        coll_id: 'coll_id'
      }
    }
  }
};

var schema2 = {
  id: 'schemas/foo2',
  type: 'object',
  properties: {
    id: {
      type: 'number'
    },
    parent_id: {
      type: 'number'
    },
    value: {
      type: 'string'
    },
    /*parent: {
      $ref: 'schemas/foo1',
      references: {
        id: 'parent_id'
      }
    }*/
  }
};

var schema3 = {
  id: 'schemas/foo3',
  type: 'object',
  properties: {
    id: {
      type: 'number'
    },
    number: {
      type: 'string'
    }
  }
};

var schema4 = {
  id: 'schemas/foo4',
  type: 'object',
  properties: {
    id: {
      type: 'number',
      default: 0
    },
    parents: {
      type: 'array',
      $ref: '#',
      default: [],
      references: {
        child_id: 'id'
      }
    }
  }
};

describe('Test SchemaFactory', function () {
  var FooBaseModel = BaseModel.extend({
    identify: function() {
      return 'foo';
    },
    overrideProperties: {
      id: {
        convert: function(value) {
          return Number(value);
        }
      },
      dyn: {
        model: function(attrs) {
          return new Foo2BaseModel();
        }
      }
    }
  });
  var Foo2BaseModel = BaseModel.extend({
    identify: function() {
      return 'foo2';
    }
  });

  var Foo3BaseCollection = BaseCollection.extend({
    initialize: function(models, options) {
      this.coll_id = options.coll_id;
    },
    identify: function() {
      return 'foo3collection';
    }
  });

  var Foo4BaseCollection = BaseCollection.extend({
    identify: function() {
      return 'foo4collection';
    }
  });

  var CustomFactory = function CustomFactory(options) {
    SchemaFactory.call(this, options);
  };

  util.inherits(CustomFactory, SchemaFactory);

  CustomFactory.prototype._getBaseCollectionForSchemaId = function(schemaId, options) {
    options = options || {};
    if (schemaId === 'schemas/foo4' && options.propertyName === 'parents') {
      return Foo4BaseCollection;
    }
    return CustomFactory.super_.prototype._getBaseCollectionForSchemaId.apply(this, arguments);
  };

  CustomFactory.prototype.getConversionFunction = function(conversion) {
    if (conversion === 'id') {
      return function(attr) {
        return Number(attr);
      };
    }
  };

  var factory;
  var Model;
  var Model2;
  var Model3;

  before(function() {
    factory = new CustomFactory({baseModel: BaseModel, baseCollection: BaseCollection});
  });

  it('should register schemas', function() {
    factory.register(schema1, {baseModel: FooBaseModel});
    factory.register(schema2, {baseModel: Foo2BaseModel});
    factory.register(schema3, {baseCollection: Foo3BaseCollection});
    factory.register(schema4);
  });

  it('should create Model classes', function() {
    Model = factory.create(schema1);
    Model2 = factory.create(schema2);
    Model3 = factory.create(schema4);
  });

  it('should test schema properties', function() {
    var m = new Model({name: 'test', foo2_id: 1, enabled: 'true', id: '11'});
    m.schema.properties.id.convert.should.be.an.Function;
    m.id.should.equal(11);
    var barDef = m.schema.properties.bar;
    barDef.name.should.equal('bars');
  });

  it('should init Model references', function() {
    var m = new Model({name: 'test', foo2_id: 1, enabled: 'true', id: 99});
    m.identify().should.equal('foo');
    m.schema.id.should.equal(schema1.id);
    m.get('created_at').should.be.an.Date;
    m.get('enabled').should.equal(true);
    var m2 = new Model2({value: 'bar'});
    m2.schema.id.should.equal(schema2.id);
    var bar = m.get('bar');
    bar.id.should.equal(1);
    bar.schema.id.should.equal(schema2.id);
    bar.identify().should.equal('foo2');
  });

  it('should init Collection reference', function() {
    var m = new Model({name: 'test', foo2_id: 1, coll_id: 2});
    m.get('enabled').should.equal(false);
    var coll = m.get('coll');
    should.exist(coll.length);
    coll.identify().should.equal('foo3collection');
    coll.coll_id.should.equal(2);
    m.get('dyn').identify().should.equal('foo2');
  });

  it('should init collection reference if default is []', function() {
    var m = new Model();
    m.get('coll').length.should.equal(0);
  });

  it('should init model with self referencing collection', function() {
    var m = new Model3({id: 1});
    m.schema.properties.parents.type.should.equal('relation');
    m.schema.properties.parents.collection.should.be.an.Function;
    m.schema.properties.parents.default.should.be.an.Array;
    should.exist(m.get('parents'));
    m.get('parents').identify().should.equal('foo4collection');
  });

  it('should override schema properties', function() {
    var Base4 = Model.extend({
      overrideProperties: {
        id: {
          type: 'number',
          default: -1
        }
      }
    });
    var Model4 = factory.create(schema4, Base4);

    var Base5 = Model4.extend({
      overrideProperties: {
        id: {
          type: 'number',
          default: -2
        }
      }
    });
    var Model5 = factory.create(schema4, Base5);

    Model3.schema.properties.id.default.should.equal(0);
    Model4.schema.properties.id.default.should.equal( -1 );
    Model5.schema.properties.id.default.should.equal( -2 );
    var m4 = new Model4();
    var m3 = new Model3();
    var m5 = new Model5();
    m4.id.should.equal( -1 );
    m3.id.should.equal(0);
    m5.id.should.equal( -2 );
  });
});
