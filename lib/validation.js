var Validator = require('jsonschema').Validator;
var v = exports.validator = new Validator();

exports.validate = function(attributes, schema) {
  var res = v.validate(attributes, schema);
  var errors = res.errors;
  if(errors.length > 0) {
    return errors;
  }
};