var Validator = require('jsonschema').Validator;
var v = exports.validator = new Validator();
var _ = require('lodash');

exports.validate = function(attributes, schema) {
  // workaround: filter out null values for validation, if not defined as required
  var attrsToValidate = _.omit(attributes, function(value, key) {
    var isNull = attributes[key] === null;
    var definition = schema.properties ? schema.properties[key] : null;
    if (isNull && (!definition || !definition.required)) {
      return true;
    }
  });
  var res = v.validate(attrsToValidate, schema);
  var errors = res.errors;
  if (errors.length > 0) {
    return _.uniq(errors);
  }
};
