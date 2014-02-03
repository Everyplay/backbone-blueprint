var should = require('chai').should();
var Model = require('..').Model;
var ValidatingModel = require('..').ValidatingModel;
var Person = require('./fixtures').ValidatingPerson;
var jsonschema = require('jsonschema');
var _ = require('underscore');

describe('Test validation', function () {

  it('should not validate with invalid data', function() {
    var employee = new Person({});
    employee.isValid().should.equal(false);
    employee.set('firstName', 1);
    employee.isValid().should.equal(false);
  });

  it('model should be valid', function() {
    var employee = new Person({firstName: 'Foo'});
    employee.isValid().should.equal(true);
  });

  it('should add custom validator', function() {
    var validator = Person.prototype.validator;
    validator.attributes.contains = function validateContains(instance, schema, options, ctx) {
      if(typeof instance !== 'string') return;
      if(typeof schema.contains !== 'string') throw new jsonschema.SchemaError('"contains" expects a string', schema);
      if(instance.indexOf(schema.contains) < 0) {
        return 'does not contain the string '+ JSON.stringify(schema.contains);
      }
    };
    var employee = new Person({firstName: 'Foo'});
    var errors = employee.validate();
    errors.length.should.be.above(0);
  });

  it('should validate dependency', function() {
    var schema = {
      id: '/schemas/foo',
      type: 'object',
      properties: {
        id: {
          type: 'integer'
        },
        data: {
          type: 'string'
        }
      },
      dependencies: {
        data: ['id']
      }
    };
    var Foo = ValidatingModel.extend({
      type: 'foo',
      schema: schema
    });
    var f = new Foo({data: 'a'});
    var errors = f.validate();
    errors.length.should.equal(1);
  });

  it('should test custom validation', function() {
    var Foo = Person.extend({
      customValidation: function(attributes, options) {
        var err = new Error('must be enabled');
        err.stack = 'must be enabled';
        if(!attributes.enabled) return [err];
      }
    });
    var f = new Foo({firstName: 'Faa'});
    var errors = f.validate();
    errors.length.should.equal(1);
    var errMsg = _.pluck(errors, 'stack').join();
    errMsg.should.equal('must be enabled');
  });
});