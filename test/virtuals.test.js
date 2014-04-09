var should = require('chai').should();
var fixtures = require('./fixtures');
var _ = require('lodash');

describe('Test Virtual fields', function () {
  var Model = fixtures.Employee.extend({
    virtuals: {
      fullname: function() {
        return this.get('title') + ' '
          + this.get('firstName') + ' '
          + this.get('surname');
      }
    }
  });
  var model;

  before(function() {
    model = new Model({
      title: 'Mr.',
      firstName: 'James',
      surname: 'Bond'
    });
  });

  it('should get fullname', function() {
    model.get('fullname').should.equal('Mr. James Bond');
  });

  it('should include fullname in JSON', function() {
    var json = model.toJSON();
    json.fullname.should.equal('Mr. James Bond');
  });
});