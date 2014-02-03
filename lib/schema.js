var modules = require('./modules');
var _ = modules._;

var Schema = {};
/**
 * Provides inheritance style Schema "extends" functionality
 * @param  {Object} target    Schema object which is being extended
 * @param  {Object} extension Schema properties to apply to target
 * @return {Object}           Returns the modified target schema
 */
Schema.extendSchema = function(target, extension) {
  for (var property in extension) {
    if (extension.hasOwnProperty(property)) {

      var extensionProperty = extension[property];
      if (extensionProperty !== undefined) {

        var targetProperty = target[property];

        // Don't process equal objects
        if (targetProperty === extensionProperty) {
          continue;
        }
        // If the target does not exist, then copy (by reference) the extension property directly
        if (targetProperty === undefined) {
          target[property] = extensionProperty;
        } else {
          // the target exists and is an object, then merge it
          if (_.isObject(targetProperty)) {
            var isRelation = property === 'model';
            if(isRelation) {
              target[property] = extensionProperty;
            } else {
              Schema.extendSchema(targetProperty, extensionProperty);
            }

          }
        }
      }
    }
  }
  return target;
};

module.exports = Schema;