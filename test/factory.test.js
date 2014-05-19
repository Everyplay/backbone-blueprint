var should = require('chai').should();
var BaseModel = require('..').Model;
var BaseCollection = require('..').Collection;
var SchemaFactory = require('..').SchemaFactory;

var schema1 = {
  id: 'schemas/foo1',
  type: 'object',
  properties: {
    id: {
      type: 'number'
    },
    name: {
      type: 'string'
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
      type: 'number'
    },
    coll_id: {
      type: 'number'
    },
    bar: {
      type: 'object',
      $ref: 'schemas/foo2',
      references: {
        id: 'foo2_id'
      },
      roles: ['owner']
    },
    coll: {
      type: 'array',
      $ref: 'schemas/foo3',
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
    value: {
      type: 'string'
    }
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

describe('Test SchemaFactory', function () {
  var factory;
  var FooBaseModel = BaseModel.extend({
    identify: function() {
      return 'foo';
    },
    overrideProperties: {
      dyn: function(attrs) {
        if (attrs.enabled) {
          console.log('ff');
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

  before(function() {
    factory = new SchemaFactory();
  });

  it('should register schemas', function() {
    factory.register(schema1, {baseModel: FooBaseModel});
    factory.register(schema2, {baseModel: Foo2BaseModel});
    factory.register(schema3, {baseCollection: Foo3BaseCollection});
  });

  it('should init Model references', function() {
    var Model = factory.create(schema1);
    var Model2 = factory.create(schema2);
    var m = new Model({name: 'test', foo2_id: 1, enabled: 'true'});
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
    var Model = factory.create(schema1);
    var m = new Model({name: 'test', foo2_id: 1, coll_id: 2});
    m.get('enabled').should.equal(false);
    var coll = m.get('coll');
    should.exist(coll.length);
    coll.identify().should.equal('foo3collection');
    coll.coll_id.should.equal(2);
  });
});
