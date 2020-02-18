import './style.css';
import moment from 'moment-timezone';

const store = {};

function getFieldValue(plugin, field) {
  const objField = Object.values(plugin.fields).find(f => f.attributes.api_key === field);
  const fieldValue = plugin.getFieldValue(field);
  if (fieldValue) {
    if (typeof fieldValue === 'object' && Object.prototype.hasOwnProperty.call(fieldValue, plugin.locale)) {
      if (fieldValue[plugin.locale]) {
        return fieldValue[plugin.locale];
      }
      return '';
    }
    if (objField.attributes.field_type === 'date_time') {
      return moment(fieldValue).tz(plugin.site.attributes.timezone).format('YYYY-MM-DD HH:mm');
    } else if (objField.attributes.field_type === 'boolean') {
      return fieldValue ? ' - ' + objField.attributes.label : '';
    } else if (typeof fieldValue === 'string') {
      return fieldValue;
    }
    return fieldValue.toString();
  }
  return '';
}

function getLinkFieldValue(plugin, linkField, field) {
    const token = plugin.parameters.global.datoCmsApiToken;
    const linkFieldUS = linkField.replace(/([A-Z])/g, function (x,y){
      return "_" + y.toLowerCase()
    });


    if (linkFieldUS === 'parent') {
      const itemType = plugin.itemType;
      const modelName = itemType.attributes.api_key.replace(/(_[a-z])/g, function (x, y) {
        return y[1].toUpperCase()
      });
      return new Promise((resolve, reject) => {
        fetch('https://graphql.datocms.com/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `{ ${modelName}(locale: cs, filter: { id: { eq: "${plugin.itemId}" } }) { parent { ${field} } } }`,
          }),
        })
          .then(res => res.json())
          .then(({ data }) => {
            if (data && data[modelName] && data[modelName].parent) {
              resolve({
                field: linkField + '.' + field,
                value: data[modelName].parent[field] ? data[modelName].parent[field] : '',
              });
            } else {
              resolve({
                field: linkField + '.' + field,
                value: '',
              });
            }
          });
      })
    } else {
      const objFields = Object.values(plugin.fields)
        .filter(f => f.relationships.item_type.data.id === plugin.itemType.id && f.attributes.api_key === linkFieldUS);
      if (objFields.length > 0) {
        const objField = objFields[0];
        const itemTypes = Object.values(plugin.itemTypes)
          .filter(t => t.id === objField.attributes.validators.item_item_type.item_types[0]);
        if (itemTypes.length > 0) {
          const itemType = itemTypes[0];
          const modelName = itemType.attributes.api_key.replace(/(_[a-z])/g, function (x, y) {
            return y[1].toUpperCase()
          });
          const value = plugin.getFieldValue(linkFieldUS);

          if (value) {
            return new Promise((resolve, reject) => {
              fetch('https://graphql.datocms.com/preview', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  query: `{ ${modelName}(locale: cs, filter: { id: { eq: "${value}" } }) { ${field} } }`,
                }),
              })
                .then(res => res.json())
                .then(({ data }) => {
                  if (data && data[modelName]) {
                    resolve({
                      field: linkField + '.' + field,
                      value: data[modelName][field] ? data[modelName][field] : '',
                    });
                  } else {
                    reject();
                  }
                });
            })
          }
        }
      }
    }

    return new Promise((resolve, reject) => {
      resolve({
        field: linkField + '.' + field,
        value: '',
      });
    });
}

function getFieldPromises(plugin, field) {
  if (field.indexOf('.') !== -1) {
    const parentField = field.substr(0, field.indexOf('.'));
    const valueField = field.substr(field.indexOf('.') + 1);
    return getLinkFieldValue(plugin, parentField, valueField);
  } else {
    return new Promise(resolve2 => {
      resolve2({ field, value: getFieldValue(plugin, field) });
    });
  }
}

function getValue(plugin, fields) {
  let output = plugin.parameters.instance.format;
  return new Promise(resolve => {
    let promises = [];
    if (Array.isArray(fields)) {
      fields.forEach((field) => {
        promises.push(getFieldPromises(plugin, field));
      });
    } else {
      promises.push(getFieldPromises(plugin, fields))
    }

    Promise.all(promises).then(values => {
      values.forEach(({ field, value }) => {
        store[field] = value;
      });
      for (const field in store) {
        output = output.replace(`{${field}}`, store[field]);
      }
    }).finally(() => {
      output = output.replace(' ()', '').trim();
      output = output.replace(/^>/, '').trim();
      resolve(output);
    });
  });
}

window.DatoCmsPlugin.init((plugin) => {
  plugin.startAutoResizer();

  function getFields() {
    const matches = plugin.parameters.instance.format.match(/\{([a-zA-Z_.]+)\}/g);

    return matches.map((m) => m.toString().replace(/^\{+|\}+$/g, ''));
  }

  const fields = getFields();

  const container = document.createElement('div');

  const input = document.createElement('span');
  input.textContent = plugin.getFieldValue(plugin.fieldPath);

  container.appendChild(input);

  document.body.appendChild(container);

  getValue(plugin, fields).then(value => {
    if (plugin.getFieldValue(plugin.fieldPath) !== value) {
      plugin.setFieldValue(plugin.fieldPath, value);
      input.textContent = value;
    }
  });

  fields.forEach((field) => {
    const fieldName = field.split('.')[0].replace(/([A-Z])/g, function (x,y){
      return "_" + y.toLowerCase()
    });
    if (fieldName !== 'parent') {
      plugin.addFieldChangeListener(fieldName, () => {
        if (plugin.locale === plugin.site.attributes.locales[0]) {
          getValue(plugin, field)
            .then(value => {
              plugin.setFieldValue(plugin.fieldPath, value);
              input.textContent = value;
            })
        }
      });
    }
  });
});
