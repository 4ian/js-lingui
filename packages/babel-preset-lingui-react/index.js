module.exports = {
  plugins: [
    require('babel-plugin-lingui-transform-js'),
    require('babel-plugin-lingui-transform-react'),
    require('babel-plugin-lingui-extract-messages')
  ]
}
