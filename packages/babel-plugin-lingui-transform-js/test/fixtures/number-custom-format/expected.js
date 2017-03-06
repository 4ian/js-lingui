i18n.t({
  id: "Format in variable {name,number,currency}",
  params: {
    name: name
  },
  formats: {
    currency: currency
  }
});
i18n.t({
  id: "One-off format {name,number,number0}, test format name collision {name,number,number1}",
  params: {
    name: name
  },
  formats: {
    number0: { digits: 4 },
    number1: { digits: 2 }
  }
});
