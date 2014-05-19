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
  this.typeCache = {
    models: {},
    collections: {}
  };

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
    //delete this.parsedSchemaCache[schemaId];
  }

  options = options || {};
  if (options.baseModel) {
    this.registeredBaseClasses.models[schemaId] = options.baseModel;
    delete this.typeCache.models[schemaId];
  }
  if (options.baseCollection) {
    this.registeredBaseClasses.collections[schemaId] = options.baseCollection;
    delete this.typeCache.collections[schemaId];
  }
};

/**
 * Expand schema
 */
SchemaFactory.prototype.parse = function(schema, rootSchema, options) {
  if (!schema) return;
  var schemaId = schema.id;
  if (schemaId && this.parsedSchemaCache[schemaId]) {
    var cached = this.parsedSchemaCache[schemaId];
    return cached;
  }
  options = options || {};

  if (schemaId !== undefined) {
    this.parsedSchemaCache[schemaId] = schema;
  }

  var properties = schema.properties;
  if (properties) {
    _.each(properties, function(property, key) {
      var parsed = this.parse(property, rootSchema);
      if (parsed && parsed.$ref) {
        parsed = this.expandReferences(parsed, rootSchema);
      }
      properties[key] = parsed;
    }, this);
  }
  return schema;
};

SchemaFactory.prototype.expandReferences = function(schema, rootSchema) {
  var reference = schema.$ref;

  if (reference) {
    if (reference === '#') {
      return rootSchema;
    }

    var referencedSchemaId = reference;
    var fetchedSchema = this.getSchemaById(referencedSchemaId);
    var referencedSchema = _.extend(
      _.omit(schema, '$ref'),
      _.clone(this.parse(fetchedSchema, fetchedSchema, {noCache: true}))
    );
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
    return referencedSchema;
  }
};

/**
 * Creates a Model from the provided Schema
 */
SchemaFactory.prototype._createModel = function(schema, options, baseModel) {
  var schemaId = schema.id;
  var cached = this.getModelFromCache(schemaId);
  if (cached) return cached;
  var BaseModel = baseModel || this._getBaseModelForSchemaId(schemaId);

  var ModelClass = BaseModel.extend({
    factory: this,
    schema: schema
  }, {
    schema: schema,
    overrideProperties: BaseModel.prototype.overrideProperties
  });

  if (schemaId) {
    this.typeCache.models[schemaId] = ModelClass;
  }

  return ModelClass;
};

SchemaFactory.prototype._getBaseModelForSchemaId = function(schemaId) {
  return (schemaId && this.registeredBaseClasses.models[schemaId]) || this.baseModel;
};

SchemaFactory.prototype._createCollection = function(schema, options, baseCollection) {
  var schemaId = schema.id;
  var cached = this.getCollectionFromCache(schemaId);
  if (cached) {
    return cached;
  }

  var BaseCollection = baseCollection
    || this.registeredBaseClasses.collections[schemaId]
    || this.baseCollection;
  var CollectionClass = BaseCollection.extend({
    model: this._createModel(schema, options),
    factory: this
  }, {
    schema: schema
  });

  if (schemaId) {
    this.typeCache.collections[schemaId] = CollectionClass;
  }

  return CollectionClass;
};

// TODO: cache
SchemaFactory.prototype._getBaseCollectionForSchemaId = function(schemaId) {
  return (schemaId && this.registeredBaseClasses.collections[schemaId]) || this.baseCollection;
};

SchemaFactory.prototype.getModelFromCache = function(schemaId) {
  if (schemaId && this.typeCache.models[schemaId]) {
    return this.typeCache.models[schemaId];
  }
};

SchemaFactory.prototype.getCollectionFromCache = function(schemaId) {
  if (schemaId && this.typeCache.collections[schemaId]) {
    return this.typeCache.collections[schemaId];
  }
};

SchemaFactory.prototype.getSchemaById = function(schemaId) {
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
