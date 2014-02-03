# Backbone-blueprint [![TravisCI][travis-img-url]][travis-ci-url]

[travis-img-url]: https://travis-ci.org/mikkolehtinen/backbone-blueprint.png?branch=master
[travis-ci-url]: https://travis-ci.org/mikkolehtinen/backbone-blueprint

Creates model/collection hierarchies based on JSON schema.

Based on JSON-Schema specification, but it's slightly modified regards handling relations etc. 

## Example

```javascript
var addressSchema = exports.addressSchema = {
  id: '/schemas/address',
  title: 'Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: {type: 'string'},
    country: {type: 'string'}
  }
};

var Address = Model.extend({
  type: 'address',
  schema: addressSchema
});

var address = new Address({
  street: '221B Baker Street ',
  city: 'London',
  country: 'England'
});
```

# Features

## Relations

Relations are defined as 
	
	type: 'relation'
	collection/model: ModelName
	
Thus relations can be either Models or Collections.

### Example

```javascript
var Addresses = exports.Addresses = Collection.extend({
  model: Address
});

var personSchema = exports.personSchema = {
  id: '/schemas/person',
  type: 'object',
  properties: {
   addresses : {
      type: 'relation',
      collection: Addresses
    }
  }
};

var person = new Person({
  addresses: [{street: 'Baker Street', city: 'London', country: 'GB'}]
});

console.log(person.get('addresses').at(0).get('country'));

```

#### Relation references
Initing a relation might need information from the main model. This is done by passing a _references_ - options to the property. E.g.

```javascript
  properties: {
    owner: {
      type: 'relation',
      model: Person,
      references: {id: 'owner_id'}
    }
  }
```
will read the value of `` owner_id `` property from the main model, and init relation automatically with it. So e.g. if a Model has ``{owner_id: 2}``, owner relation will be inited with:

```javascript
person = new Person({id: 2})
```

## Validation
Validation is done by [jsonschema](https://github.com/tdegrunt/jsonschema) module. Validating Models can be created by extending from ValidatingModel.

### Example

```javascript
var schema = {
  id: '/schemas/foo',
  type: 'object',
  properties: {
    data: {
      type: 'string'
    }
  }
};
var Foo = ValidatingModel.extend({
  type: 'foo',
  schema: schema
});
var f = new Foo({data: 'a'});
var errors = f.validate();
```
Will give an error, since 'data' had incorrect type.


#### Custom validation

If you want to make more complex validations, that jsonschema does not support, you can extend the _customValidation_ method, see tests for more info.

## Projection

Passing option ``{recursive: true}`` to toJSON, will also include relation in the JSON output. Sometimes it's useful to control which attributes are included in the JSON. This can be done with projection settings. E.g.

```javascript
var projection = {
  owner: ['id', 'title'],
  removeFields: ['addresses']
};
var json = person.toJSON({recursive: true, projection: projection});
```
will include only 'id' & 'title' fields from the owner relation and will remove the 'addresses' relation completely from the output. 

### Projection options

#### onlyFields

onlyFields option will whitelist the given properties, thus includes only the specified properties in the JSON output.

#### removeFields

removeFields option will blacklist the given properties, thus removes the specified properties in the JSON output.

#### projection presets

You can define a projection preset in the schema, e.g.

```javascript
properties: {
  ...
},
projection: {
  mini: {
    onlyFields: ['city']
  }
}
```
Then you can give projection options as

	person.toJSON({recursive: true, projection: 'mini'})

## Schema options

### convert

A property can define ``convert`` function which is called when attribute is set. E.g.:

```javascript
    properties: {
      id: {
        type: 'integer',
        convert: function(attribute) {
          return Number(attribute);
        }
      }, ...
```

## Info
This project is based on https://github.com/redpie/backbone-schema

## License

The MIT License