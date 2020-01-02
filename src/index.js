import './style.css';

function getFieldValue(plugin, field) {
  console.log(plugin.fieldTypes);
  const fieldValue = plugin.getFieldValue(field);
  if (fieldValue) {
    if (typeof fieldValue === 'object' && Object.prototype.hasOwnProperty.call(fieldValue, plugin.locale)) {
      if (fieldValue[plugin.locale]) {
        return fieldValue[plugin.locale];
      }
      return '';
    }
    if (typeof fieldValue === 'string') {
      return fieldValue;
    }
    return fieldValue.toString();
  }
  return '';
}

function getLinkFieldValue(plugin, linkField, field) {
    const token = plugin.parameters.global.datoCmsApiToken;
    const modelName = plugin.itemType.attributes.api_key;

    return new Promise((resolve, reject) => {
        console.log(`{ ${modelName}(locale: ${plugin.locale}, filter: { id: { eq: "${plugin.itemId}" } }) { ${linkField} { ${field} } } }`);
        fetch('https://graphql.datocms.com/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `{ ${modelName}(locale: ${plugin.locale}, filter: { id: { eq: "${plugin.itemId}" } }) { ${linkField} { ${field} } } }`,
          }),
        }).then(res => res.json()).then(({ data }) => {
          if (data && data[modelName]) {
            resolve({
              field: linkField + '.' + field,
              value: data[modelName][linkField] ? data[modelName][linkField][field] : '',
            });
          } else {
            console.log(data, modelName, linkField, field);
            reject();
          }
        });
    })
}

function getValue(plugin, fields) {
  let output = plugin.parameters.instance.format;
  return new Promise(resolve => {
    const promises = fields.map((field) => {
      if (field.indexOf('.') !== -1) {
        const parentField = field.substr(0, field.indexOf('.'));
        const valueField = field.substr(field.indexOf('.') + 1);
        return getLinkFieldValue(plugin, parentField, valueField);
      } else {
        return new Promise(resolve2 => {
          resolve2({ field, value: getFieldValue(plugin, field) });
        })
      }
    });

    Promise.all(promises).then(values => {
      values.forEach(({ field, value }) => {
        output = output.replace(`{${field}}`, value);
      })
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
    plugin.addFieldChangeListener(field, () => {
      if (plugin.locale === plugin.site.attributes.locales[0]) {
        getValue(plugin, fields).then(value => {
          plugin.setFieldValue(plugin.fieldPath, value);
          input.textContent = value;
        })
      }
    });
  });
});
