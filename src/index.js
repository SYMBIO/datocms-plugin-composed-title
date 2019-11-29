import './style.css';

function getValue(plugin, fields) {
  let output = plugin.parameters.instance.format;
  fields.forEach((field) => {
    const fieldValue = plugin.getFieldValue(field);
    if (fieldValue) {
      if (typeof fieldValue === 'object' && Object.prototype.hasOwnProperty.call(fieldValue, plugin.locale)) {
        output = output.replace(`{${field}}`, fieldValue[plugin.locale]);
      } else if (typeof fieldValue === 'string') {
        output = output.replace(`{${field}}`, fieldValue);
      }
    }
  });

  output = output.replace(' ()', '');

  return output;
}

window.DatoCmsPlugin.init((plugin) => {
  plugin.startAutoResizer();

  function getFields() {
    const matches = plugin.parameters.instance.format.match(/\{([a-z_]+)\}/g);

    return matches.map((m) => m.toString().replace(/^\{+|\}+$/g, ''));
  }

  const fields = getFields();

  const container = document.createElement('div');

  const input = document.createElement('span');
  input.textContent = plugin.getFieldValue(plugin.fieldPath);

  container.appendChild(input);

  document.body.appendChild(container);

  if (plugin.getFieldValue(plugin.fieldPath) !== getValue(plugin, fields)) {
    plugin.setFieldValue(plugin.fieldPath, getValue(plugin, fields));
  }

  fields.forEach((field) => {
    plugin.addFieldChangeListener(field, () => {
      if (plugin.locale === plugin.site.attributes.locales[0]) {
        plugin.setFieldValue(plugin.fieldPath, getValue(plugin, fields));
        input.textContent = getValue(plugin, fields);
      }
    });
  });
});
