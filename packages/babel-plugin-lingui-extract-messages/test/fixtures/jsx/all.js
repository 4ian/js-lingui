<span id="ignore" />;
<Trans id="msg.hello" />;
<Trans id="msg.default" defaults="Hello World" />;
<Trans id="msg.default" defaults="Hello World" />;
<Trans id="Hi, my name is <0>{name}</0>" values={{ count }} />;
i18n._("{count, plural, one {# book} other {# books}}", {
  values: {
    count: count
  }
})
