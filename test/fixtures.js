var Db = require('backbone-db');
var BaseModel = require('..').Model;
var ValidatingModel = require('..').ValidatingModel;
var Collection = require('..').Collection;

var TestDb = new Db('test');

var Model = BaseModel.extend({
  sync: TestDb.sync.bind(TestDb)
});

var addressSchema = exports.addressSchema = {
  id: '/schemas/address',
  title: 'Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: {type: 'string'},
    country: {type: 'string'}
  },
  projection: {
    mini: {
      onlyFields: ['city']
    }
  }
};

var Address = Model.extend({
  type: 'address',
  schema: addressSchema
});

var Addresses = exports.Addresses = Collection.extend({
  model: Address,
  initialize: function(models, options) {
    this.options = options;
    Addresses.__super__.initialize.apply(this, arguments);
  }
});

var companySchema = {
  id: '/schemas/company',
  title: 'Company',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    name: { type: 'string' }
  }
};

var Company = Model.extend({
  type: 'company',
  schema: companySchema,
});

var personSchema = exports.personSchema = {
  id: '/schemas/person',
  type: 'object',
  properties: {
    id: {
      type: 'integer'
    },
    company_id: {
      type: 'integer'
    },
    spouse_id: {
      type: 'integer'
    },
    firstName: {
      type: 'string',
      required: true,
      contains: 'a'
    },
    surname: {
      type: 'string'
    },
    title: {
      type: 'string',
      default: 'mr'
    },
    enabled: {
      type: 'boolean',
      default: false
    },
    employer: {
      type: 'relation',
      model: Company,
      references: {id: 'company_id'}
    },
    spouse: {
      type: 'relation',
      '$ref': '#',
      references: {id: 'spouse_id'}
    },
    addresses : {
      type: 'relation',
      collection: Addresses
    }
  },
  projection: {
    mini: {
      employer: ['name'],
      removeFields: ['enabled']
    },
    full: {
      employer: ['id', 'name']
    }
  }
};

var Employee = exports.Employee = Model.extend({
  type: 'person',
  schema: personSchema
});

var ValidatingPerson = exports.ValidatingPerson = ValidatingModel.extend({
  type: 'person',
  schema: personSchema
});