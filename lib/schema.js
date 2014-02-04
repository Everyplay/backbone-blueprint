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
  var newSchema = _.cloneDeep(target);
  return _.merge(newSchema, extension);
};

module.exports = Schema;