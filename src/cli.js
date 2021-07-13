const { build } = require('gluegun')

async function run(argv) {
  const cli = build()
    .brand('j2c')
    .src(__dirname)
    .plugins('./node_modules', { matching: 'j2c-*', hidden: true })
    .help()
    .version()
    .exclude([
      'meta',
      'strings',
      'semver',
      'system',
      'template',
      'patching',
      'package-manager'
    ])
    .create()

  const toolbox = await cli.run(argv)

  return toolbox
}

module.exports = { run }
