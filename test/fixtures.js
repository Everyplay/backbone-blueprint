var Db = require('backbone-db');
var blueprint = require('..');
var BaseModel = blueprint.Model;
var ValidatingModel = blueprint.ValidatingModel;
var Collection = blueprint.Collection;
var _ = require('lodash');
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
    name: {
      type: 'string'
    },
    country: {
      type: 'string'
    }
  },
  projection: {
    minimal: {
      onlyFields: ['name']
    }
  }
};

var Company = exports.Company = Model.extend({
  type: 'company',
  schema: companySchema,
  initialize: function (attrs, options) {
    options = options || {};
    Company.__super__.initialize.call(this, attrs, options);
    this.parent = options.parent;
  }
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
    fullname: {
      type: 'string',
      virtual: true
    },
    enabled: {
      type: 'boolean',
      default: false
    },
    employer: {
      type: 'relation',
      model: Company,
      roles: ['admin'],
      references: {id: 'company_id'},
      values: {
        country: 'GB'
      }
    },
    spouse: {
      type: 'relation',
      '$ref': '#',
      references: {id: 'spouse_id'}
    },
    addresses : {
      type: 'relation',
      collection: Addresses,
      values: {
        address_type: 'foo'
      }
    }
  },
  projection: {
    mini: {
      employer: ['name'],
      removeFields: ['enabled']
    },
    full: {
      employer: ['id', 'name']
    },
    minimal: {
      onlyFields: ['firstName', 'employer']
    }
  },
  defaultProjectionOptions: {
    recursive: true,
    projection: 'mini'
  }
};

exports.Employee = Model.extend({
  type: 'person',
  schema: personSchema
});

var schemaNoRef = _.extend(personSchema,  {
    id: '/schemas/person_noref',
    properties: _.extend(personSchema.properties, {
      employer_noref: {
        type: 'relation',
        model: Company
      }
    })
});

exports.EmployeeNoref = exports.Employee.extend({
  type: 'person',
  schema: schemaNoRef
});

exports.ValidatingPerson = ValidatingModel.extend({
  type: 'person',
  schema: personSchema
});

var FooCompany = Company.extend({
  type: 'foo_company'
});

var dynamicSchema = blueprint.Schema.extendSchema(personSchema, {
  properties : {
    dynamic_relation: {
      type: 'relation',
      model: function(attrs) {
        if (attrs.type === 'foo') {
          return new FooCompany(attrs);
        }
        return new Company(attrs);
      },
      references: {
        id: 'company_id',
        type: 'company_type'
      }
    }
  }
});

exports.DynamicRelationModel = Model.extend({
  type: 'dynamic',
  schema: dynamicSchema
});