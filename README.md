# openapi-autowrapper
This is a tool to dynamically build wrappers for OpenAPI/Swagger compatible APIs, it uses `fetch()` internally so it will work in the browser as well as node, though so you'll need an [18](https://nodejs.org/en/blog/announcements/v18-release-announce)+ copy of node for that feature.

Optinally you can initialize it with `{dev:true}` for in-console prettyprinted documentation.
![image](https://user-images.githubusercontent.com/94414189/235275280-906ee9d4-4fde-4aea-b0a0-3ad3d1303173.png)

## Usage
```js
import autowrapper from 'openapi-autowrapper'
```
an example using the automatic1111 openapi 

```js
let api = await autowrapper('http://localhost:7860') //autowrapper() defaults to 'http://localhost:5000' if called without parameters
let response = await api['/sdapi/v1/txt2img'].GET({prompt: 'an angel with a shotgun'}) //nightcore remix
///////
> response
> {
    images: ['iVBORw0KGgoAAAANSUhEUgA...'], 
    info: {prompt: 'an angel with a shotgun', all_prompts: Array(1), negative_prompt: '', all_negative_prompts: Array(1), seed: 1802462605, …},
    parameters: {enable_hr: false, denoising_strength: 0, firstphase_width: 0, firstphase_height: 0, hr_scale: 2, …}
}
```

