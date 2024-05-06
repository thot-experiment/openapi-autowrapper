const callJSONEndpoint = (url,method) => options => {
  const postData = JSON.stringify(options)
  const reqOpts = {
    method, headers: { 'Content-Type': 'application/json' },
    body: postData
  }
  return fetch(url, reqOpts)
    .then(res => {
      if (res.ok) {
        return res.json().then(data => {
          data.info ? data.info = JSON.parse(data.info) : null
          return data
        }).catch(a => a)
      } else {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
    })
    .catch(error => {
      console.error(`Error sending request: ${error}`)
    })
}

const callHTTPEndpoint = (url,method) => () => {
  const reqOpts = {
    method,
  }
  return fetch(url, reqOpts)
    .then(res => {
      if (res.ok) {
        //TODO i actually have  no way of knowing that these are all json but
        //they seem to be so this works
        return res.json()
      } else {
        throw new Error(`Error ${res.status}: ${res.statusText}`)
      }
    })
    .catch(error => {
      console.error(`Error sending request: ${error}`)
    })
}

const create_endpoint = (base_path, components, dev) => ([path, methods]) => {
  let autodoc = {}
  let available_methods = Object.entries(methods).map(([k,m]) => {
    let method = k.toUpperCase()
    //process method
    let {
      requestBody,
      responses,
      summary} = m

    let method_object = {path, method, summary, responses}

    //export extra properties 
    if (dev) {
      method_object.rawJSON = m//{requestBody, operationId}
    }

    let derfPath = path => {
      let refkey = path.replace('#/components/schemas/', '')
      return components.schemas[refkey]
    }

    let derefernceSchema = req_or_resp => {
      let schema = {}
      //try to get json schema for requests
      //check if request takes a json
      let isJSON = req_or_resp?.content?.['application/json']?.schema
      if (isJSON) {
        let ref = isJSON?.['$ref']
        if (ref) {
          schema = derfPath(ref)
          //if it doesn't have a ref the schema is json (i think?)
        } else {
          //these are all just "args" in my experience
          schema = isJSON
          if (schema?.items?.['$ref']) {
            schema.items = derfPath(schema.items['$ref'])
          }
        }
      } else if (requestBody) {
        //these are the auth methods, unsupported for now so this is supressed
        //console.warn('weird request type/schema', path, requestBody)
      } 
      return schema
    }
    method_object.schema = derefernceSchema(requestBody)
    //dereference repsonses
    Object.values(method_object.responses).forEach(response => {
      response.schema = derefernceSchema(response)
      delete response.content
    })

    let endpoint
    if (method_object.schema.properties) {
      method_object.defaults = Object.fromEntries(Object.entries(method_object.schema.properties)
        .filter(a=>a).map(([key, {default:def}]) => [key, def]))
      endpoint = callJSONEndpoint(base_path+path, method)
      Object.assign(endpoint, method_object)

    } else {
      //these are all get or head requests
      endpoint = callHTTPEndpoint(base_path+path, method)
      Object.assign(endpoint, method_object)
    }


    return [method,endpoint]
  })

  return [path, Object.fromEntries(available_methods)]    
}

const API_DOCS = {
  //TODO write some docs
}

const OpenAPI = async (url, options={}) => {

  if (typeof url === 'object') {
    options = url
    url = options.url
  }
  const {dev} = options
  url = url || 'http://localhost:5000'

  let tools = {}
  //TODO when using any of the console tools, have the option to print out working example
  //TODO support options (un/pw), cache api def
  
  const api_def = options.api_def || await fetch(url+'/openapi.json').then(a => {
    if (a.status === 200) {
      return a.json()
    } else {
      return {error: `status ${a.status}: ${a.statusText}`}
    }
  }).catch(error => ({error}))

  const {error,openapi,info,paths,components} = api_def
  if (error) {
    console.error(error)
    return error
  }

  let api = Object.entries(paths).map(create_endpoint(url, components, dev))

  if (dev) {
    console.log('library running in dev mode')
    tools.search = (query) => {
      if (!query) console.log('tools.search("queryOrRegExp")')
      let matches = api.filter(([key]) => key.match(query))
      if (!matches.length) matches = api.filter(([key,endpt]) => {
        Object.values(endpt).map(o => o.summary?.match(query)).reduce((a,b) => a && b)
      })
      return matches
    }
    tools.describe = endpoint => {
      //make tolerant to being passed an entry
      if (endpoint.length == 2) {
        endpoint = endpoint[1]
      }

      //TODO this maybe is kinda janky, might be overloading things too much
      let methods = Object.entries(endpoint)
        .filter(([key,value]) => ["PUT","POST","GET","HEAD","PATCH","CONNECT","DELETE","TRACE","OPTIONS"].includes(key))
      if (!methods.length) {
        console.warn('malformed endpoint:', endpoint)
        return
      }
      let {path,summary} = methods[0][1]
      let available_methods = methods.map(([key]) => key)
      console.log(`%c"${summary} @ ${path}"\n`, "color:black;font-size: 18px;background-color:lightgreen;margin-top:15px;")
      console.log(`%cmethods:`, 'font-weight: bold; font-size: 14px;')
      methods.forEach(([key, value]) => {
        let {schema, defaults, responses}  = value
        console.groupCollapsed(`${key}`)
        console.log(`await api['${path}'].${key}(...)`)
        if(defaults) {
          console.groupCollapsed("    request defaults")
          console.log(defaults)
          console.groupEnd()
        }
        if (Object.keys(schema).length) {
          console.groupCollapsed("    request schema")
          console.log(schema)
          console.groupEnd()
        }
        console.groupCollapsed("    response schemas")
        Object.entries(responses).forEach(([http_code, {description,schema}]) => {
          console.log(`${http_code} -> ${description}`)
          console.log(schema)
        })
        console.groupEnd()
        console.groupEnd()
      })
      let doc = API_DOCS[endpoint]
    }
    //also attach .describe to the individual endpoints
    api.forEach(([path, entry]) => entry.describe = tools.describe.bind(null,entry))
  }
  return Object.assign(Object.fromEntries(api), tools, {url,dev})
}  

export default OpenAPI
