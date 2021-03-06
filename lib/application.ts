import { serve, Server, } from 'https://deno.land/std/http/server.ts';
import { assert } from "https://deno.land/std/testing/asserts.ts";

import {ServerRequest, HTTPOptions, Middlewares} from './type.d.ts';
import {
  acceptable,
} from "https://deno.land/std/ws/mod.ts";
import {Context} from './context.ts';

export type Next = () => Promise<void>
export type State = {
  serve?: typeof serve 
} 

export class Application extends EventTarget {

	#middlewares: Middlewares[];
  #server: typeof serve | undefined;
	constructor(options?: State){
	  super();
		this.#middlewares = [];
		this.#server = options?.serve
	}

	compose(middlewares: Middlewares[]) {
		return function composeMiddlewares(ctx: Context, next?: Next) {
			function dispatch(i: number): Promise<void> {
				let fn: Middlewares | undefined = middlewares[i];
				if (i === middlewares.length) {
					fn = next;
				}
				if (!fn) {
					return Promise.resolve();
				}
				try {
          return Promise.resolve(fn(ctx, function () {
            return dispatch(i+1);
          }))
        } catch (e) {
          return Promise.reject(e)
        }
			}
			return dispatch(0);
		}
	}
	/**
	 * @param callback customer function
	 * 
	 **/
	use = (callback: Middlewares) =>  {
		this.#middlewares.push(callback);
	}	

  #handleRequest = async (req: ServerRequest, server: Server) => {
			const ctx = new Context(this, req);
			await this.compose(this.#middlewares)(ctx);
			// is not websocket
			const respond = ctx.response.appResponse();
			if (!acceptable(req)) {
        await req.respond(respond);
        assert(serve)
      }
  }

	async listen(options: HTTPOptions={port: 3000}, callback?: () => void) {
    callback && callback();
    const server = this.#server?.(options) || serve(options);
    try {
      for await (const req of server) {
        this.#handleRequest(req, server)      
      }
    } catch(e) {
      throw Deno.errors.NotFound
    }
    
      
	}
}
