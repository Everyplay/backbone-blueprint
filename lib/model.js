var _ = require('underscore');
var Backbone = require('backbone');
var utils = require('./utils');
var validation = require('./validation');

// init relation's attributes with ones from current model
function getRelationValues(relation, modelAttributes) {
  var attrs = {};
  _.each(relation.references, function(ref, key) {
    if(modelAttributes[ref]) attrs[key] = modelAttributes[ref];
  });
  if(_.keys(attrs).length) {
    return attrs;
  }
}

function changeSchema(ctx, schema) {
  var relationDefinitions = ctx.relationDefinitions = {};
  var properties = schema.properties;
  var required = schema.required = schema.required || [];
  var defaults = ctx.defaults || {};
  // preprocess relationDefinitions
  _.each(properties, function(property, name) {
    if(property.type === 'relation') {
      relationDefinitions[name] = {
        Class: property.model || property.collection,
        references: property.references,
        type: property.model ? 'model' : 'collection',
        $ref: property.$ref
      };
    }
    // support for alternative syntax for specifying required attributes
    if(property.required && (_.indexOf(required, name) === -1)) {
      required.push(name);
    }
    // support setting defaults in schema
    if(property['default'] !== undefined) {
      defaults[name] = property['default'];
    }
  });
  ctx.defaults = function() {
    var defaultVals = _.clone(defaults);
    _.each(defaultVals, function(val, key) {
      if(_.isFunction(val)) {
        defaultVals[key] = val.call(null);
      }
    });
    return defaultVals;
  };
}

var Model = Backbone.Model.extend({
  constructor: function(attributes, options) {
    var ret = Backbone.Model.call(this, attributes, options);
    return ret;
  },

  set: function(key, value, options) {
    var attributes;
    if(_.isObject(key) || key === undefined) {
      attributes = key;
      options = value;
    } else {
      attributes = {};
      attributes[key] = value;
    }

    options = options || {};
    if(options.validate === undefined) {
      options.validate = false;
    }
    attributes = this._prepareRelations(attributes, options);
    attributes = this._convertAttributes(attributes, options);
    return Backbone.Model.prototype.set.call(this, attributes, options);
  },

  toJSON: function(options) {
    options = options || {};
    var json = {};
    var projection;
    if(_.isString(options.projection)) {
      // read projection config from schema
      projection = this.schema
        && this.schema.projection
        && this.schema.projection[options.projection];
      options.projection = projection;
    } else if(_.isObject(options.projection)) {
      projection = options.projection;
    }

    function convertProjectionOptions(opts, name) {
      if(opts.projection
          && _.isObject(opts.projection)
          && opts.projection[name]) {
        // if projection is an array of fields -> transform it to only include given fields
        if(_.isArray(opts.projection[name])) {
          opts.projection = {
            onlyFields: opts.projection[name]
          };
        } else if(_.isString(opts.projection[name])) {
          opts.projection = opts.projection[name];
        }
      }
    }

    function convertProperty(property, name) {
      var value;
      var attribute = this.attributes[name];
      if(attribute === undefined) return;

      if(this.relationDefinitions[name]) {
        // recursively create json for relations
        if(options.recursive && typeof attribute.toJSON === 'function') {
          // execute recursion only in top level to avoid cyclic dependencies
          var opts = _.omit(options, 'recursive');
          if(opts.projection && _.isObject(opts.projection)) {
            // whitelisting is not recursive
            opts.projection = _.omit(opts.projection, 'onlyFields');
          }
          convertProjectionOptions(opts, name);
          value = attribute.toJSON(opts);
          var isCollection = attribute instanceof Backbone.Collection;
          // pick only specified fields
          if(projection && projection[name] && _.isArray(projection[name]) && !isCollection) {
            value = _.pick.apply(null, [value, projection[name]]);
          }
        }
      } else {
        value = attribute;
      }
      if(value !== undefined) {
        json[name] = value;
      }
    }

    if(this.schema && this.schema.properties) {
      _.each(this.schema.properties, convertProperty, this);
    } else {
      json = Backbone.Model.prototype.toJSON.apply(this, arguments);
    }
    // remove blacklisted keys
    if(projection && projection.removeFields) {
      _.each(projection.removeFields, function(fieldToRemove) {
        if(json.hasOwnProperty(fieldToRemove)) {
          delete(json[fieldToRemove]);
        }
      });
    }
    // handle whitelisting
    if(projection && projection.onlyFields) {
      json =  _.pick.apply(null, [json, projection.onlyFields]);
    }
    return json;
  },

  _convertAttributes: function(attributes, options) {
    _.each(attributes, function(attribute, name) {
      var attrDefinition = this.schema && this.schema.properties && this.schema.properties[name];
      if(!attrDefinition) {
        return;
      } else if(attrDefinition.convert) {
        attributes[name] = attrDefinition.convert(attribute);
      } else if(attrDefinition.type === 'number') {
        attributes[name] = isNaN(attribute) ? attribute : Number(attribute);
      } else if(attrDefinition.type === 'integer') {
        attributes[name] = isNaN(attribute) ? attribute : parseInt(attribute, 10);
      } else if(attrDefinition.type === 'date') {
      // dates are converted automatically
        var date = _.isDate(attribute) ? attribute : new Date(attribute);
        if(!date.getTime()) attributes[name] = attribute;
        else attributes[name] = date;
      }
    }, this);
    return attributes;
  },

  _prepareRelations: function(attributes, options) {
    var self = this;
    var relationValues;
    if(!attributes) attributes = {};

    _.each(this.relationDefinitions, function(relation, name) {
      var relationInited =
        attributes[name] instanceof Backbone.Model ||
        attributes[name] instanceof Backbone.Collection;
      if(!relationInited && relation.Class) {
        if(relation.type === 'model') {
          relationValues = getRelationValues(relation, attributes);
          if(relationValues) {
            // only create relation Model if some values have been set
            attributes[name] = new relation.Class(relationValues, _.extend({silent: true}, options));
          }
        } else if(relation.type === 'collection') {
          var models = attributes[name];
          // only create relation Collection if some values or relations have been set
          relationValues = getRelationValues(relation, attributes);
          if(models && !_.isArray(models)) models = [models];
          if(models && models.length || relationValues) {
            attributes[name] = new relation.Class(models, _.extend({silent: true}, relationValues, options));
          }
        }

      } else if(!relationInited && relation.$ref && !options.noRelations) {
        relationValues = getRelationValues(relation, attributes);
        if(relationValues) {
          attributes[name] = new self.constructor(relationValues, _.extend({silent: true, noRelations: true}, options));
        }
      }
    });
    return attributes;
  },

  changeSchema: function(schema) {
    changeSchema(this, schema);
  }

});

Model.extend = function(protoProps, staticProps) {
  var schema = protoProps.schema;
  if(schema) {
    changeSchema(protoProps, schema);
  }
  return Backbone.Model.extend.call(this, protoProps, staticProps);
};

Model.formatTemplatedProperties = utils.formatTemplatedProperties;

var ValidatingModel = Model.extend({
  validator: validation.validator,
  validate: function(attributes, options) {
    if(!this.schema) return;
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
  customValidation: function(attributes, options) {
  }
});

exports.Model = Model;
exports.ValidatingModel = ValidatingModel;