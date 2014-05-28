var should = require('chai').should();
var fixtures = require('./fixtures');
var _ = require('lodash');

describe('Test virtualProperties', function () {
  describe('simple virtual property', function() {
    var Model = fixtures.Employee.extend({
      virtualProperties: {
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

    it('should not include fullname in toJSON by default', function() {
      var json = model.toJSON();
      should.not.exist(json.fullname);
    });

    it('should include fullname in JSON', function() {
      var json = model.toJSON({includeVirtualProperties: true});
      json.fullname.should.equal('Mr. James Bond');
    });

    it('should change fullname', function() {
      model.set('surname', 'Blunt');
      model.get('fullname').should.equal('Mr. James Blunt');
    });
  });

  describe('getters & setters', function() {
    var Model = fixtures.Employee.extend({
      virtualProperties: {
        fullname: {
          get: function() {
            return this.get('title') + ' '
              + this.get('firstName') + ' '
              + this.get('surname');
          },
          set: function (key, value, options) {
            var names = value.split(' ');
            this.set('firstName', names[0], options);
            this.set('surname', names[1], options);
          },
          permissions: {
            'admin': ['*']
          }
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

    it('should set fullname', function(){
      model.set('fullname', 'Test Name');
      model.get('fullname').should.equal('Mr. Test Name');
    });

    it('should set fullname as object', function(){
      model.set({fullname: 'New Name', id: 1});
      model.get('fullname').should.equal('Mr. New Name');
      model.get('id').should.equal(1);
    });

    it('should not include fullname in toJSON by default', function() {
      var json = model.toJSON();
      should.not.exist(json.fullname);
    });

    it('should include fullname in JSON', function() {
      var json = model.toJSON({includeVirtualProperties: ['fullname']});
      json.fullname.should.equal('Mr. New Name');
    });
  });

});