var should = require('chai').should();
var BaseModel = require('..').Model;
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
    foo2_id: {
      type: 'number'
    },
    bar: {
      type: 'relation',
      $ref: 'schemas/foo2',
      references: {
        id: 'foo2_id'
      }
    },
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

describe('Test SchemaFactory', function () {
  var factory;

  before(function() {
    factory = new SchemaFactory();
  });

  it('should register schemas', function() {
    factory.register(schema1);
    factory.register(schema2);
  });

  it('should init Model references', function() {
    var Model = factory.create(schema1);
    var Model2 = factory.create(schema2);
    var m = new Model({name: 'test', foo2_id: 1});
    m.schema.id.should.equal(schema1.id);
    var m2 = new Model2({value: 'bar'});
    m2.schema.id.should.equal(schema2.id);
    var bar = m.get('bar');
    bar.id.should.equal(1);
    bar.schema.id.should.equal(schema2.id);
  });
});