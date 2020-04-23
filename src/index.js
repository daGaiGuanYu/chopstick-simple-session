// 由于会话是放在内存中管理的，因此程序重启后，会话全部失效
// 改进方案：redis

//@ts-check
const http = require('http')
const Cookie = require('cookie')
const Chopstick = require('chopstick') // 依赖 chopstick 没毛病
const getUniqueString = require('simple-unique-string')
const pool = {}
const expire = 2*60*60*1000
const tokenName = 'chopstickSessionId'

function getExpire(){
  let result = new Date()
  result.setTime(result.getTime() + expire)
  return result.toUTCString()
}

/**
 * @param {any} userinfo
 * @param {http.ServerResponse} response
 */
function put(userinfo, response){
  if(!(response instanceof http.ServerResponse)){
    console.error('session.put 的第二个参数是 http.ServerResponse 类型')
    throw Chopstick.CommonError.Unknown
  }

  console.log(`用户[${userinfo.id}]登录成功，放入会话池`)
  let token = getUniqueString()
  let timeoutID = setTimeout( () => {
    delete pool[token]
  }, expire)

  pool[token] = {
    userinfo,
    timeoutID
  }

  response.setHeader('Set-Cookie', `${tokenName}=${token};path=/;httpOnly;expires=${getExpire()}`)
  return token
}

/** @param {http.IncomingMessage} request */
function get(request){
  if(!(request instanceof http.IncomingMessage)){
    console.error('session.get 的参数是 http.IncomingMessage 类型')
    throw Chopstick.CommonError.Unknown
  }

  let token = getTokenFromRequest(request)
  if(!token) return

  let result = pool[token]
  if(!result) return

  refill(request)
  return result
}

/** @param {http.IncomingMessage} request */
function refill(request){
  if(!(request instanceof http.IncomingMessage)){
    console.error('session.refill 的参数是 http.IncomingMessage 类型')
    throw Chopstick.CommonError.Unknown
  }

  let token = getTokenFromRequest(request)
  if(!token) return true // true 是“真”错了
  
  let session = pool[token]
  if(!session) return true

  clearTimeout(session.timeoutID)
  session.timeoutID = setTimeout( () => {
    delete pool[token]
  }, expire)
}

/**
 * @param {http.IncomingMessage} request 
 * @param {http.ServerResponse} response
 */
function drop(request, response){
  if(!(request instanceof http.IncomingMessage)){
    console.error('session.drop 的第一个参数是 http.IncomingMessage 类型')
    throw Chopstick.CommonError.Unknown
  }
  if(!(response instanceof http.ServerResponse)){
    console.error('session.drop 的第二个参数是 http.ServerResponse 类型')
    throw Chopstick.CommonError.Unknown
  }

  let token = getTokenFromRequest(request)
  if(!token) return true // “真“错了

  let user = pool[token]
  if(!user) return true

  delete pool[token]
  console.log(`用户[${user.userinfo.id}] 注销登录`)
  response.setHeader('Set-Cookie', `${tokenName}=heihei;path=/;httpOnly;expires=${new Date().toUTCString()}`)
}

/**
 * @param {function} fn 
 * @param {import('chopstick').RequestContext} ctx
 */
function loadSessionInfoGlove(fn, ctx){
  let userSession = get(ctx.req)
  if(userSession){
    ctx.sessionData = userSession
    return fn(ctx)
  }else{
    return Chopstick.CommonError.NotLogin
  }
}

/** @param {http.IncomingMessage} req */
function getTokenFromRequest(req){
  let cookieObj = Cookie.parse(req.headers.cookie||'')
  return cookieObj[tokenName]
}

module.exports = {
  put, get, drop, refill, loadSessionInfoGlove
}