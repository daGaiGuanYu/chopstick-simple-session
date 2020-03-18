// 由于会话是放在内存中管理的，因此程序重启后，会话全部失效
// 改进方案：redis

const Chopstick = require('chopstick') // 依赖 chopstick 没毛病
const QueryString = require('querystring')
const getUniqueString = require('simple-unique-string')
const pool = {}
const expire = 2*60*60*1000

function put(id){
  console.log(`用户[${id}]登录成功，放入会话池`)
  let token = getUniqueString()
  let timeoutID = setTimeout( () => {
    delete pool[token]
  }, expire)

  pool[token] = {
    id,
    timeoutID
  }
  return token
}

function get(token){
  let result = pool[token]
  // 没有会话
  if(result){
    refill(token)
    return result
  }
}

function refill(token){
  let session = pool[token]
  if(session){
    clearTimeout(session.timeoutID)
    session.timeoutID = setTimeout( () => {
      delete pool[token]
    }, expire)
  }else
    return true // true 代表“真错了“
}

function drop(token){
  try{
    let userid = pool[token].id
    delete pool[token]
    console.log(`用户[${userid}] 注销登录`)
    return true
  }catch(e){
    console.error('登录态都没了，还注什么销')
    return false
  }
}

function loadLoginGlove(fn, ctx){
  let cookieObj = QueryString.parse(ctx.request.headers.cookie)
  let token = cookieObj.token
  
  let userSession = get(token)
  if(userSession){
    ctx.sessionData = userSession
    return fn(ctx)
  }else{
    throw Chopstick.CommonError.NotLogin
  }
}

module.exports = {
  put, get, drop, refill, loadLoginGlove
}