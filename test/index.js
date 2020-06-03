const { Server, Handler } = require('chopstick')
const SSession = require('../src/index')

Server.start(8974)

Handler.add('GET', '/', ctx => {
  SSession.put(ctx.res, {
    name: 1,
    id: 3
  }, {
    tel: 2,
    haha: 'weixianfa'
  })
  return 1
})
