// 由于会话是放在内存中管理的，因此程序重启后，会话全部失效
// 改进方案：redis

//@ts-check
const http = require('http')
const Chopstick = require('chopstick') // 依赖 chopstick 没毛病
const QueryString = require('querystring')
const getUniqueString = require('simple-unique-string')
const pool = {}
const expire = 2*60*60*1000

function getExpire(){
  let result = new Date()
  result.setTime(result.getTime() + expire)
  return result.toUTCString()
}

/**
 * @param {string|number} id
 * @param {http.ServerResponse} response
 */
function put(id, response){
  console.log(`用户[${id}]登录成功，放入会话池`)
  let token = getUniqueString()
  let timeoutID = setTimeout( () => {
    delete pool[token]
  }, expire)

  pool[token] = {
    id,
    timeoutID
  }

  response.setHeader('Set-Cookie', `token=${token};path=/;httpOnly;expires=${getExpire()}`)
  return token
}

/** @param {http.IncomingMessage} request */
function get(request){
  let token = getTokenFromRequest(request)
  let result = pool[token]
  // 没有会话
  if(result){
    refill(request)
    return result
  }
}

/** @param {http.IncomingMessage} request */
function refill(request){
  let token = getTokenFromRequest(request)
  let session = pool[token]
  if(session){
    clearTimeout(session.timeoutID)
    session.timeoutID = setTimeout( () => {
      delete pool[token]
    }, expire)
  }else
    return true // true 代表“真错了“
}

/**
 * @param {http.IncomingMessage} request 
 * @param {http.ServerResponse} response
 */
function drop(request, response){
  let token = getTokenFromRequest(request)
  try{
    let userid = pool[token].id
    delete pool[token]
    console.log(`用户[${userid}] 注销登录`)
    response.setHeader('Set-Cookie', `token=haha;path=/;httpOnly;expires=${new Date().toUTCString()}`)
    return true
  }catch(e){
    console.error('登录态都没了，还注什么销')
    return false
  }
}

/**
 * @param {function} fn 
 * @param {import('chopstick').RequestContext} ctx
 */
function loadLoginGlove(fn, ctx){
  let userSession = get(ctx.req)
  if(userSession){
    ctx.sessionData = userSession
    return fn(ctx)
  }else{
    throw Chopstick.CommonError.NotLogin
  }
}

/** @param {http.IncomingMessage} req */
function getTokenFromRequest(req){
  let cookieObj = QueryString.parse(req.headers.cookie)
  return cookieObj.token
}

module.exports = {
  put, get, drop, refill, loadLoginGlove
}