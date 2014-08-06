var _ = require('lodash');
var Backbone = require('backbone');
var sanitizer = require('sanitizer');
var utils = require('./utils');
var validation = require('./validation');

function isBackbone(model) {
  if (!model) return false;
  return model instanceof Backbone.Model ||
         model instanceof Backbone.Collection;
}

function isSame(modelA, modelB, relation) {
  if (!modelA || !modelB) return false;
  if (!isBackbone(modelA) || !isBackbone(modelB) || relation.type !== 'model')
    return false;

  return _.all(relation.references, function(val, key) {
    return modelA.has(key) && modelB.has(val) && modelA.get(key) === modelB.get(val);
  });
}

// init relation's attributes with ones from current model
function getRelationValues(relation, modelAttributes) {
  var attrs = {};
  _.each(relation.references, function(ref, key) {
    if (modelAttributes[ref]) attrs[key] = modelAttributes[ref];
  });
  if (_.keys(attrs).length) {
    return this._convertAttributes(attrs);
  }
}

function getClass(property) {
  return property.model || property.collection;
}

function getRoles(property, name) {
  var roles = property.roles;
  if (!roles) {
    return [name];
  } else if (!Array.isArray(roles)) {
    roles = [name, roles];
  } else {
    roles = [name].concat(roles);
  }
  return roles;
}

function getType(property) {
  if (property.model) {
    return 'model';
  } else if (property.collection) {
    return 'collection';
  } else {
    return 'unknown';
  }
}

function getReferences(property, name, schema) {
  if (property.references) {
    return property.references;
  }
  var srcAttr, dstAttr, type;
  var Model = property.model;
  var Collection = property.collection;
  if (!Model && Collection) {
    Model = Collection.prototype.model;
    type = Collection.prototype.type;
  }
  if (!Model) {
    return;
  }
  type = Model.prototype.type || type || name;
  srcAttr = Model.prototype.idAttribute;
  if (!type ||  !srcAttr) {
    return;
  }
  dstAttr = type + '_id';
  if (!schema || !schema.properties || !schema.properties[dstAttr]) {
    return;
  }
  var references = {};
  references[srcAttr] = dstAttr;
  return references;
}

function convertDefaultValue(property) {
  // support setting defaults in schema
  if (property['default'] !== undefined) {
    var defaultValue = property['default'];
    if (property.type === 'date' && defaultValue === 'now') {
      return function() {
        return new Date();
      };
    }
    return defaultValue;
  }
}

function changeSchema(ctx, schema, staticProps) {
  var relationDefinitions = ctx.relationDefinitions = {};
  var properties = schema.properties;
  var overrideProperties = staticProps && staticProps.overrideProperties;
  var required = schema.required = schema.required || [];
  var defaults = ctx.defaults || {};

  // preprocess relationDefinitions
  _.each(properties, function(property, name) {
    // model may override schema property
    if (overrideProperties && overrideProperties[name]) {
      property = _.extend({}, property, overrideProperties[name]);
      properties[name] = property;
    }
    if (property.type === 'relation') {
      var relation = {};
      relation.Class = getClass(property, name);
      relation.roles = getRoles(property, name);
      relation.type = getType(property, name);
      relation.references = getReferences(property, name, schema);
      relation.values = property.values;
      relation.$ref = property.$ref;
      relationDefinitions[name] = relation;
    }
    // support for alternative syntax for specifying required attributes
    if (property.required && (_.indexOf(required, name) === -1)) {
      required.push(name);
    }
    // support setting defaults in schema
    if (property['default'] !== undefined) {
      defaults[name] = convertDefaultValue(property);
    }
  });

  ctx.defaults = function() {
    var defaultVals = _.clone(defaults);
    _.each(defaultVals, function(val, key) {
      if (_.isFunction(val)) {
        defaultVals[key] = val.call(this);
      }
    }, this);
    return defaultVals;
  };
}

var Model = Backbone.Model.extend({
  constructor: function(attributes, options) {
    return Backbone.Model.call(this, attributes, options);
  },

  initialize: function(attributes, options) {
    options = options || {};
    Model.__super__.initialize.apply(this, arguments);
    this._defaultProjectionOptions = options.defaultProjectionOptions
      || (this.schema && this.schema.defaultProjectionOptions);
  },

  get: function(attr) {
    if (this.virtualProperties) {
      if (_.isFunction(this.virtualProperties[attr])) return this.virtualProperties[attr].call(this);
      if (_.isObject(this.virtualProperties[attr]) && _.isFunction(this.virtualProperties[attr].get)) {
        return this.virtualProperties[attr].get.call(this);
      }
    }
    return Backbone.Model.prototype.get.apply(this, arguments);
  },

  set: function(key, value, options) {
    var attributes;
    if (_.isObject(key) || key === undefined) {
      attributes = key;
      options = value;
    } else {
      attributes = {};
      attributes[key] = value;
    }

    options = options || {};
    if (options.validate === undefined) {
      options.validate = false;
    }
    attributes = this._prepareRelations(attributes, options);
    attributes = this._convertAttributes(attributes, options);
    var ret = Backbone.Model.prototype.set.call(this, attributes, options);

    if (this.virtualProperties) {
      _.each(attributes, function(attrValue, attrKey) {
        if (_.isObject(this.virtualProperties[attrKey]) && _.isFunction(this.virtualProperties[attrKey].set)) {
          this.virtualProperties[attrKey].set.call(this, attrKey, attrValue, options);
        }
      }, this);
    }
    return ret;
  },

  toJSON: function(options) {
    if (this.toJSONInProgress) {
      return;
    }
    this.toJSONInProgress = true;
    options = _.clone(options) || {};
    var origOptions = _.clone(options);
    var json = {};
    var projection;
    if (_.isString(options.projection)) {
      // read projection config from schema
      projection = this.schema && this.schema.projection && this.schema.projection[options.projection];
      options.projection = projection;
    } else if (_.isObject(options.projection)) {
      projection = options.projection;
    }

    function convertProjectionOptions(opts, name) {
      if (opts.projection && _.isObject(opts.projection) && opts.projection[name]) {
        // if projection is an array of fields -> transform it to only include given fields
        if (_.isArray(opts.projection[name])) {
          opts.projection = {
            onlyFields: opts.projection[name]
          };
        } else if (_.isString(opts.projection[name])) {
          opts.projection = opts.projection[name];
        }
      }
    }

    function convertProperty(properties, name) {
      var value;
      var attribute = this.attributes[name];
      if (attribute === undefined) return;
      if (properties.virtual) return;

      if (this.relationDefinitions[name]) {
        // recursively create json for relations
        if (options.recursive && typeof attribute.toJSON === 'function') {
          // execute recursion only in top level to avoid cyclic dependencies
          var opts = _.clone(origOptions);
          if (opts.projection && _.isObject(opts.projection)) {
            // whitelisting is not recursive
            opts.projection = _.omit(opts.projection, 'onlyFields');
          }
          convertProjectionOptions(opts, name);
          value = attribute.toJSON(opts);
          var isCollection = attribute instanceof Backbone.Collection;
          // pick only specified fields
          if (projection && projection[name] && _.isArray(projection[name]) && !isCollection) {
            value = _.pick.apply(null, [value, projection[name]]);
          }
        }
      } else if (properties && properties.sanitize === true) {
        value = this._sanitizeAttribute(attribute, name);
      } else {
        value = attribute;
      }
      if (value !== undefined) {
        json[name] = value;
      }
    }

    if (this.schema && this.schema.properties) {
      _.each(this.schema.properties, convertProperty, this);
    } else {
      json = Backbone.Model.prototype.toJSON.apply(this, arguments);
    }

    // Tterate over all virtualProperties if options.includeVirtualProperties is set.
    // It may be boolean (true means to include all props) or array specifying which properties to include
    if (options.includeVirtualProperties) {
      var filter = _.isArray(options.includeVirtualProperties) ? options.includeVirtualProperties : false;
      _.each(this.virtualProperties, function (virtualField, name) {
        if (filter && !_.contains(filter, name)) return;
        json[name] = this.get(name);
      }, this);
    }

    // remove blacklisted keys
    if (projection && projection.removeFields) {
      _.each(projection.removeFields, function(fieldToRemove) {
        if (json.hasOwnProperty(fieldToRemove)) {
          delete(json[fieldToRemove]);
        }
      });
    }

    // handle whitelisting
    if (projection && projection.onlyFields) {
      json = _.pick.apply(null, [json, projection.onlyFields]);
    }
    this.toJSONInProgress = false;
    return json;
  },

  _sanitizeAttribute: function (attribute, name) {
    return sanitizer.sanitize(attribute.toString());
  },

  _convertAttributes: function(attributes, options) {
    _.each(attributes, function(attribute, name) {
      var attrDefinition = this.schema && this.schema.properties && this.schema.properties[name];
      if (!attrDefinition) {
        return;
      } else if (attrDefinition.convert) {
        attributes[name] = attrDefinition.convert(attribute);
      } else if (attrDefinition.conversion && this.factory) {
        var conversionFn = this.factory.getConversionFunction(attrDefinition.conversion);
        if (conversionFn) attributes[name] = conversionFn(attribute);
      } else if (attrDefinition.type === 'sanitized_string') {
        attributes[name] = this._sanitizeAttribute(attribute, name);
      } else if (attrDefinition.type === 'number') {
        attributes[name] = isNaN(attribute) ? attribute : Number(attribute);
      } else if (attrDefinition.type === 'integer') {
        attributes[name] = isNaN(attribute) ? attribute : parseInt(attribute, 10);
      } else if (attrDefinition.type === 'date') {
        // dates are converted automatically
        if (attribute === null) {
          attributes[name] = new Date();
          return;
        }
        var date = _.isDate(attribute) ? attribute : new Date(attribute);
        if (!date.getTime()) {
          attributes[name] = attribute;
        } else {
          attributes[name] = date;
        }
      } else if (attrDefinition.type === 'boolean') {
        attributes[name] = utils.toBoolean(attribute);
      }
    }, this);
    return attributes;
  },

  _prepareRelations: function(attributes, options) {
    var self = this;
    var relationValues;
    var initWithValues;

    if (!attributes) attributes = {};
    _.each(this.relationDefinitions, function(relation, name) {
      var existing = self.get(name);
      var relationInitiated = isBackbone(attributes[name]);

      if (!relationInitiated && relation.Class) {
        var staticValues = relation.values;
        if (relation.type === 'model') {
          relationValues = getRelationValues.call(self, relation, attributes);
          initWithValues = _.extend({}, staticValues, relationValues);
          if (relationValues) {
            // only create relation Model if some values have been set
            attributes[name] = new relation.Class(initWithValues, _.extend({
              silent: true,
              parent: self
            }, options));
          }
        } else if (relation.type === 'collection') {
          var models = attributes[name];
          // only create relation Collection if some values or relations have been set
          relationValues = getRelationValues.call(self, relation, attributes);
          initWithValues = _.extend({}, staticValues, relationValues);
          if (models && !_.isArray(models)) models = [models];
          if (models && models.length || relationValues) {
            attributes[name] = new relation.Class(models, _.extend({
              silent: true,
              parent: self
            }, initWithValues, options));
          }
        }
      } else if (!relationInitiated && relation.$ref && !options.noRelations) {
        relationValues = getRelationValues.call(self, relation, attributes);
        if (relationValues) {
          attributes[name] = new self.constructor(relationValues, _.extend({
            silent: true,
            noRelations: true,
            parent: self
          }, options));
        }
      }

      if (existing && attributes[name] && isSame(existing, attributes[name], relation) && relation.type === 'model') {
        delete attributes[name];
      }
    });
    return attributes;
  },

  changeSchema: function(schema) {
    changeSchema(this, schema);
  },

  defaultProjectionOptions: function() {
    return this._defaultProjectionOptions;
  }

});

Model.extend = function(protoProps, staticProps) {
  var schema = protoProps.schema;
  if (schema) {
    changeSchema(protoProps, schema, staticProps);
  }
  return Backbone.Model.extend.call(this, protoProps, staticProps);
};

Model.formatTemplatedProperties = utils.formatTemplatedProperties;

var ValidatingModel = Model.extend({
  validator: validation.validator,
  validate: function(attributes, options) {
    if (!this.schema) return;
    // If no attributes are supplied, then validate all schema properties
    // by building an attributes array containing all properties.
    if (attributes === undefined) {
      attributes = {};
      // Produce a list of all fields and their values.
      _.each(this.schema.properties, function(value, key) {
        attributes[key] = this.attributes[key];
      }, this);
      // Add any attributes that do not appear in schema
      _.each(this.attributes, function(value, key) {
        if (attributes[key] === undefined) {
          attributes[key] = this.attributes[key];
        }
      }, this);
    }
    return validation.validate(attributes, this.schema) ||
      this.customValidation(attributes, options);
  },
  // this method can be overriden to add validation not supported by jsonschema
  customValidation: function() {}
});

exports.Model = Model;
exports.ValidatingModel = ValidatingModel;
