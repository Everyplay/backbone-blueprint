require('chai').should();
var fixtures = require('./fixtures');
var Employee = fixtures.Employee;
var Collection = require('..').Collection;

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
});