var should = require('chai').should();
var Model = require('..').Model;
var Employee = require('./fixtures').Employee;
var personSchema = require('./fixtures').personSchema;
var Addresses = require('./fixtures').Addresses;
var Schema = require('..').Schema;

describe('Test relations', function () {
  var employee;

  it('should create relations', function() {
    employee = new Employee({
      id: 3340,
      firstName: 'John',
      surname: 'Foo',
      company_id: 222,
      spouse_id: 3300,
      addresses: [{street: 'Baker Street', city: 'London', country: 'GB'}]
    });
    employee.get('title').should.equal('mr');
    employee.get('employer').get('id').should.equal(222);
    employee.get('spouse').get('id').should.equal(3300);
    should.not.exist(employee.get('spouse').get('employer'));
    employee.get('addresses').at(0).get('country').should.equal('GB');
    employee.toJSON({recursive: true}).employer.id.should.equal(222);

    var employee2 = new Employee({
      id: 3341,
      firstName: 'Jane',
      surname: 'Foo',
    });
    should.not.exist(employee2.get('addresses'));
    should.not.exist(employee2.get('employer'));
    should.not.exist(employee2.get('spouse'));
    employee2.set('addresses', [{street: 'Baker Street', city: 'London', country: 'GB'}]);
    employee2.get('addresses').at(0).should.be.ok;
    employee2.set('spouse_id', 3333);
    employee2.get('spouse').get('id').should.equal(3333);
  });

  it('should output correct JSON based on projection config', function() {
    employee.get('employer').set('name', 'Foo corp');
    var projection = {
      spouse: ['id', 'title'],
      removeFields: ['addresses']
    };
    // test without projection set
    var json = employee.toJSON({recursive: true});
    should.exist(json.spouse.enabled);
    should.exist(json.spouse.title);
    should.exist(json.addresses);
    should.exist(json.employer.id);
    should.exist(json.employer.name);

    // test /w projection
    json = employee.toJSON({recursive: true, projection: projection});
    should.exist(json.spouse.title);
    should.not.exist(json.spouse.enabled);
    should.not.exist(json.addresses);
    should.exist(json.employer.id);
    should.exist(json.employer.name);

    // test whitelisting
    projection = {
      onlyFields: ['firstName', 'surname', 'spouse']
    };
    json = employee.toJSON({recursive: true, projection: projection});
    Object.keys(json).length.should.equal(3);

    // test /w schema projection
    json = employee.toJSON({
      recursive: true,
      projection: 'mini'
    });
    should.not.exist(json.employer.id);
    should.exist(json.employer.name);

    json = employee.toJSON({
      recursive: true,
      projection: 'full'
    });
    should.exist(json.employer.id);
    should.exist(json.employer.name);

    // test projection for collection
    projection = {
      addresses: ['street']
    };
    json = employee.toJSON({recursive: true, projection: projection});
    json.addresses.length.should.equal(1);
    var address = json.addresses[0];
    Object.keys(address).length.should.equal(1);
    should.exist(address.street);

    // test projection with collection & model "preset"
    projection = {
      addresses: 'mini',
      spouse: 'mini'
    };
    json = employee.toJSON({recursive: true, projection: projection});
    json.addresses.length.should.equal(1);
    address = json.addresses[0];
    Object.keys(address).length.should.equal(1);
    should.exist(address.city);
    should.exist(json.spouse);
    var spouse = json.spouse;
    should.exist(spouse.id);
    should.not.exist(spouse.enabled);
  });

  it('should not save relations, unless specified so', function(done) {
    var id;
    var employee = new Employee({
      firstName: 'John',
      surname: 'Foo',
      company_id: 222,
      spouse_id: 3300,
      addresses: [{street: 'Baker Street', city: 'London', country: 'GB'}]
    });

    function save(cb) {
      employee.save(null, {
        success: function() {
          id = employee.id;
          cb();
        },
        error: function(err) {
          cb(err);
        }
      });
    }

    function fetch(cb) {
      employee = new Employee({id: id});
      employee.fetch({
        success: function() {
          cb();
        },
        error: function(err) {
          cb(err);
        }
      });
    }

    save(function(err) {
      fetch(function(err) {
        should.not.exist(employee.get('addresses'));
        employee.get('spouse').get('id').should.equal(3300);
        done();
      });
    });

  });

  it('should init relation with default value', function() {
    var schema = exports.personSchema = {
      id: '/schemas/foo',
      type: 'object',
      properties: {
        id: {
          type: 'integer'
        },
        addresses : {
          type: 'relation',
          collection: Addresses,
          default: [],
          references: {id: 'company_id'}
        }
      }
    };
    var Foo = Employee.extend({
      type: 'foo',
      schema: schema
    });
    var f = new Foo({company_id: 'xyz'});
    var addresses = f.get('addresses');
    should.exist(addresses);
    addresses.length.should.equal(0);
    addresses.options.id.should.equal('xyz');
  });

  it('should format templated properties', function() {
    var Backbone = require('backbone');
    var TestModel = Model.extend({
      url: Model.formatTemplatedProperties('/companies/{company_id}/employees/{employer_id}')
    });
    var test = new TestModel({company_id: 222, employer_id: 11});
    test.url().should.equal('/companies/222/employees/11');
  });

  it('should test inheritance', function() {
    var Manager = Employee.extend({
      title: function() {
        return 'manager' + this.id;
      }
    });
    var engineerSchema = Schema.extendSchema(personSchema, {
      properties: {
        manager: {
          type: 'relation',
          model: Manager,
          references: {id: 'manager_id'}
        }
      }
    });
    var Engineer = Employee.extend({
      schema: engineerSchema,
      title: function() {
        return 'engineer' + this.id;
      }
    });
    var managerSchema = Schema.extendSchema(personSchema, {
      properties: {
        subordinate: {
          type: 'relation',
          model: Engineer,
          references: {id: 'subordinate_id'}
        }
      }
    });
    Manager.prototype.changeSchema(managerSchema);

    var engineer = new Engineer({id: 1, manager_id: 2});
    var manager = new Manager({id: 2, subordinate_id: 1});
    engineer.title().should.equal('engineer1');
    manager.title().should.equal('manager2');
    engineer.get('manager').id.should.equal(2);
    engineer.get('manager').title().should.equal('manager2');
    manager.get('subordinate').title().should.equal('engineer1');
  });

  it('should test overriding a relation', function() {
    var Parent = Employee.extend({
      type: 'parent',
      title: function() {
        return 'parent' + this.id;
      }
    });

    var schema = {
      properties: {
        creator: {
          type: 'relation',
          model: Parent,
          references: {id: 'relation_id'}
        }
      }
    };


    var User = Employee.extend({
      type: 'user',
      schema: schema,
      title: function() {
        return 'user' + this.id;
      }
    });

    var newSchema = Schema.extendSchema(schema, {
      properties: {
        creator: {
          type: 'relation',
          model: User,
          references: {id: 'relation_id'}
        }
      }
    });

    var NewUser = User.extend({
      schema: newSchema
    });

    var u = new User({relation_id: 1});
    u.get('creator').title().should.equal('parent1');
    var n = new NewUser({relation_id: 1});
    n.get('creator').title().should.equal('user1');
  });

});


