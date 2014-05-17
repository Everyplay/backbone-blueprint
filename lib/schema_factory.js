var _ = require('lodash');
var Model = require('./model').Model;
var Collection = require('./collection');

/**
 * SchemaFactory provides methods to register and create new Models and Collections
 * from JSON Schemas.
 * @constructor
 */
var SchemaFactory = function SchemaFactory(options) {
  options = options || {};
  this.options = options;

  // Caches:
  // list of registered schemas, indexed by schema.id
  this.registeredSchemas = {};
  // cache for parsed schemas
  this.parsedSchemaCache = {};
  // Base Classes registered for schema.id
  this.registeredBaseClasses = {
    models: {},
    collections: {}
  };
  this.typeCache = {};

  this.baseModel = options.baseModel || Model;
  this.baseCollection = options.baseCollection || Collection;
};

/**
 * Create a Model or Collection from the provided schema
 * @param  {String|Object} schema  Schema definition or the schema id of a previously registered schema
 * @param  {Object} baseClass  Provides an optional model or collection which overrides the default base class.
 * @return {Object} Returns the contructed model or collection
 */
SchemaFactory.prototype.create = function(schema, baseClass) {
  if (_.isString(schema)) {
    schema = this.getSchemaById(schema);
  } else if (schema.id) {
    this.register(schema, baseClass);
  }

  schema = this.parse(schema, schema);

  if (schema.type && schema.type === 'array') {
    return this._createCollection(schema, undefined, baseClass);
  }
  return this._createModel(schema, undefined, baseClass);
};

/**
 * Registers the provided schema and optional baseClass.
 * @param  {String|Object} schema a schema id or a schema object
 * @param  {Object} options define baseModel & baseCollection for this schema
 * @return {this}
 */
SchemaFactory.prototype.register = function(schema, options) {
  var schemaId;
  if (_.isString(schema)) {
    schemaId = schema;
  } else {
    schemaId = schema.id;
  }

  if (schemaId === undefined || schemaId === null || schemaId === '') {
    throw new Error('Cannot register a schema with no id');
  }

  if (_.isObject(schema)) {
    this.registeredSchemas[schemaId] = schema;
    delete this.parsedSchemaCache[schemaId];
  }

  options = options || {};
  if (options.baseModel) {
    this.registeredBaseClasses.models[schemaId] = options.baseModel;
    delete this.typeCache[schemaId];
  }
  if (options.baseCollection) {
    this.registeredBaseClasses.collections[schemaId] = options.baseCollection;
  }
};

/**
 * Parse & expand schema
 */
SchemaFactory.prototype.parse = function(schema, rootSchema, options) {
  if (!schema) return;
  var schemaId = schema.id;
  if (schemaId && this.parsedSchemaCache[schemaId]) {
    return this.parsedSchemaCache[schemaId];
  }
  options = options || {};
  var reference = schema.$ref;
  if (reference && this.parsedSchemaCache[reference]) {
    return this.parsedSchemaCache[reference];
  }

  // To avoid infinite loops on circular schema references, define the
  // expanded schema before evaluating it
  if (schemaId !== undefined) {
    this.parsedSchemaCache[schemaId] = schema;
  }

  // Expand references
  if (reference) {
    if (reference === '#') {
      return rootSchema;
    }
    var referencedSchemaId = reference;
    var fetchedSchema = this.getSchemaById(referencedSchemaId);
    var referencedSchema = this.parse(fetchedSchema, fetchedSchema);
    // set type & references from parent schema
    if (schema.type === 'array') {
      referencedSchema.collection = this._createCollection(
        referencedSchema,
        undefined,
        this._getBaseCollectionForSchemaId(referencedSchemaId)
      );
    } else {
      referencedSchema.model = this._createModel(
        referencedSchema,
        undefined,
        this._getBaseModelForSchemaId(referencedSchemaId)
      );
    }

    referencedSchema.type = 'relation';
    referencedSchema.references = schema.references;
    return referencedSchema;
  }

  var properties = schema.properties;
  if (properties) {
    _.each(properties, function(property, key) {
      properties[key] = this.parse(property, rootSchema);
    }, this);
  }

  return schema;
};

/**
 * Creates a Model from the provided Schema
 */
SchemaFactory.prototype._createModel = function(schema, options, baseModel) {
  var schemaId = schema.id;
  var cached = this.getBaseClassFromCache(schemaId);
  if (cached) return cached;
  var typeName = 'foo'; //TODO
  var BaseModel = baseModel || this._getBaseModelForSchemaId(schemaId);

  var ModelClass = BaseModel.extend({
    factory: this,
    schema: schema,
    typeName: typeName
  }, {
    // Make the schema and typeName also available as static properties of the type
    schema: schema,
    typeName: typeName
  });

  if (schemaId) {
    this.typeCache[schemaId] = ModelClass;
  }

  return ModelClass;
};

SchemaFactory.prototype._getBaseModelForSchemaId = function(schemaId) {
  return (schemaId && this.registeredBaseClasses.models[schemaId]) || this.baseModel;
};

SchemaFactory.prototype._createCollection = function(schema, options, baseCollection) {
  var schemaId = schema.id;
  var cached = this.getBaseClassFromCache(schemaId);
  if (cached) return cached;

  var typeName = 'foo'; //TODO

  var BaseCollection = baseCollection
    || this.registeredBaseClasses.collections[schemaId]
    || this.baseCollection;
  var CollectionClass = BaseCollection.extend({
    model: this._createModel(schema, options),
    factory: this,
    typeName: typeName
  }, {
    schema: schema,
    typeName: typeName
  });
  return CollectionClass;
};

// TODO: cache
SchemaFactory.prototype._getBaseCollectionForSchemaId = function(schemaId) {
  return (schemaId && this.registeredBaseClasses.collections[schemaId]) || this.baseCollection;
};

SchemaFactory.prototype.getBaseClassFromCache = function(schemaId) {
  // Attempt to re-use previously constructed models
  if (schemaId && this.typeCache[schemaId]) {
    return this.typeCache[schemaId];
  }
};

SchemaFactory.prototype.getSchemaById = function(schemaId) {
  if (!schemaId) {
    return;
  }
  schemaId = schemaId.split('#')[0];

  var schema = this.registeredSchemas[schemaId];
  if (schema === undefined) {
    schema = this.fetch(schemaId);
    if (schema !== undefined) {
      this.registeredSchemas[schemaId] = schema;
    } else {
      throw new Error('Cannot find schema ' + (schemaId ? schemaId : ''));
    }
  }

  return schema;
};

/**
 * Override this method to provide a way to fetch schema from a server
 * @return {Object|undefined} Returns the schema or undefined if not found
 */
SchemaFactory.prototype.fetch = function(schemaId) {
  return undefined;
};

module.exports = SchemaFactory;
