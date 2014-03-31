var should = require('chai').should();
var fixtures = require('./fixtures');
var Employee = fixtures.Employee;
var Collection = require('..').Collection;
var _ = require('lodash');

describe('Test Collection', function () {
  var TestCollection = Collection.extend({
    model: Employee
  });
  var collection;

  it('should init Collection', function() {
    collection = new TestCollection(null, {defaultProjectionOptions: {recursive: true}});
    collection.length.should.equal(0);
  });

  it('should add model to Collection', function() {
    var employee = new Employee({
      id: 3340,
      firstName: 'John',
      surname: 'Foo',
      company_id: 222,
      spouse_id: 3300,
      addresses: [{
        street: 'Baker Street',
        city: 'London',
        country: 'GB'
      }]
    });
    employee.get('employer').set('name', 'Foo corp');
    collection.add(employee);
    collection.length.should.equal(1);
  });

  it('should output json based on projection', function() {
    var json = collection.toJSON({recursive: true});
    var emp = json[0];
    emp.addresses.length.should.equal(1);
    emp.addresses[0].city.should.equal('London');
  });

  it('collection should have default projection options', function() {
    var opts = collection.defaultProjectionOptions();
    opts.recursive.should.equal(true);
  });

  it('collection projection options can be defined in collection definition', function() {
    var ACollection = TestCollection.extend({
      defaultProjectionOptions: function() {
        return {
          projection: {
            onlyFields: ['foo']
          }
        };
      }
    });
    var c = new ACollection();
    should.exist(c.defaultProjectionOptions().projection.onlyFields);
  });

  it('collection defaultProjectionOptions should default to model`s options', function() {
    var c = new TestCollection();
    c.defaultProjectionOptions().projection.should.equal('mini');
  });

  it('collection should apply projection', function() {
    var c = new TestCollection();
    var m = new Employee({
      id: 3340,
      firstName: 'John',
      surname: 'Foo',
      company_id: 222,
      spouse_id: 3341,
      addresses: [{
        street: 'Baker Street',
        city: 'London',
        country: 'GB'
      }]
    });
    var m2 = new Employee({
      id: 3341,
      firstName: 'Jane',
      surname: 'Foo',
      company_id: 222,
      spouse_id: 3340,
      addresses: [{
        street: 'Baker Street',
        city: 'London',
        country: 'GB'
      }]
    });
    var company = new fixtures.Company({name: 'Foo inc.', id: 222});
    m.set('employer', company);
    m2.set('employer', company);
    c.add(m);
    c.add(m2);
    var json = c.toJSON({projection: 'minimal', recursive: true});
    _.each(json, function(o) {
      should.exist(o.employer.name);
      should.not.exist(o.employer.id);
    });
  });
});