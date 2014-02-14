var should = require('chai').should();
var BaseModel = require('..').Model;
var Schema = require('..').Schema;
var addressSchema = require('./fixtures').addressSchema;

describe('Test schema', function () {
  var testSchema = {
    id: '/schemas/test',
    type: 'object',
    properties: {
      id: {
        type: 'integer'
      },
      date: {
        type: 'date',
        default: function() {
          return new Date();
        }
      },
      nohtml:  {
        type: 'sanitized_string'
      },
      nohtmlInJSONOutput: {
        type: 'string',
        sanitize: true
      },
      foo: {
        type: 'string',
        convert: function(attribute) {
          return 'foo-' + attribute;
        }
      }
    }
  };

  var TestModel = BaseModel.extend({
    type: 'test',
    schema: testSchema
  });


  it('should set default attributes correctly', function(done) {
    var now = new Date();
    var date;
    function proceed() {
      var t = new TestModel();
      date = t.get('date');
      date.should.be.an.instanceof(Date);
      date.getTime().should.be.above(now.getTime());
      setTimeout(testAnother, 10);
    }

    function testAnother() {
      var t = new TestModel();
      t.get('date').should.be.above(date);
      done();
    }

    setTimeout(proceed, 10);
  });

  it('should convert attribute', function() {
    var model = new TestModel({
      id: '123',
      foo: 'bar',
      nohtml: '<a onmouseover="javascript:alert()" href="javascript:alert()">' +
        '<script type="text/javascript">alert("kissa")</script>' +
        '<iframe src="http://google.com"></iframe><a style="font-size: 1000px" href="test">X&S&S</a></a>'
    });
    (typeof model.get('id')).should.equal('number');
    model.get('foo').should.equal('foo-bar');
    model.get('nohtml').should.equal('<a><iframe></iframe><a>X&amp;S&amp;S</a></a>');
  });

  it('should sanitize attribute in output', function() {
    var model = new TestModel({
      id: '123',
      foo: 'bar',
      nohtmlInJSONOutput: '<a onmouseover="javascript:alert()" href="javascript:alert()">' +
        '<script type="text/javascript">alert("kissa")</script>' +
        '<iframe src="http://google.com"></iframe><a style="font-size: 1000px" href="test">X&S&S</a></a>'
    });
    (typeof model.get('id')).should.equal('number');
    model.get('foo').should.equal('foo-bar');
    model.get('nohtmlInJSONOutput').should.equal('<a onmouseover="javascript:alert()" href="javascript:alert()">' +
      '<script type="text/javascript">alert("kissa")</script>' +
      '<iframe src="http://google.com"></iframe><a style="font-size: 1000px" href="test">X&S&S</a></a>');

    model.toJSON().nohtmlInJSONOutput.should.equal('<a><iframe></iframe><a>X&amp;S&amp;S</a></a>');

  });


  it('should extend schema', function() {
    var newSchema = {
      properties: {
        street: {
          required: true
        }
      }
    };
    var streetRequiredSchema = Schema.extendSchema(addressSchema, newSchema);
    var street = streetRequiredSchema.properties.street;
    street.required.should.equal(true);
    street.type.should.equal('string');
    should.not.exist(addressSchema.properties.street.required);
  });


});