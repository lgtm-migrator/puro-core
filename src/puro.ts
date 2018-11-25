/**
 * @file src/puro.ts
 *
 * Copyright (C) 2018 | Giacomo Trudu aka `Wicker25`
 *
 * This file is part of Puro.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Server } from './http';
import { Request, Response, NextFunction } from './http';

import {
  requestHandler,
  responseHandler,
  errorHandler,
  error404Handler
} from './http';

import { Plugin } from './plugin';

import { Container } from './container';

import { getConnection, closeConnection } from './database';

import { forOwn as _forOwn } from 'lodash';

/**
 * The definition for Puro's server options.
 */
export interface IPuroOptions {
  [key: string]: any;
}

/**
 * The Puro's server.
 */
export class Puro {
  /**
   * The Express' instance.
   */
  server: any;

  /**
   * The installed plugins.
   */
  plugins: Plugin[] = [];

  // TODO
  container: Container;

  /**
   * The server options.
   */
  options: IPuroOptions = {
    basepath: '/api/'
  };

  /**
   * Constructor method.
   */
  constructor(options?: IPuroOptions) {
    this.options = Object.assign(this.options, options);
    this.server = Server();
    this.container = new Container();
  }

  /**
   * Installs a plugin into the server.
   */
  install(plugin: Plugin) {
    this.plugins.push(plugin);
  }

  /**
   * Listens for connections on the specified host and port.
   */
  listen(port: number, hostname?: string) {
    this.setupServer();
    return this.server.listen(port, hostname);
  }

  /**
   * Sets up the server.
   */
  private setupServer() {
    this.container.define('database', {
      load: async () => {
        return getConnection();
      },
      unload: async () => {
        return closeConnection();
      }
    });

    // Install the request and response handlers
    this.server.use(requestHandler);
    this.server.use(responseHandler);

    // Install the plugin routers
    this.plugins.forEach(plugin => {
      plugin.prepare(this.container);
      this.server.use(this.options.basepath, plugin.router);

      _forOwn(plugin.services, (definition: any, name: string) => {
        this.container.define(name, definition);
      });
    });

    // Install the plugin services
    this.plugins.forEach(plugin => {
      this.server.use(this.options.basepath, plugin.router);
    });

    // Install the error handlers
    this.server.use(errorHandler);
    this.server.use(error404Handler);

    // Install the middleware for cleaning up the container services
    this.server.use(
      async (request: Request, response: Response, next: NextFunction) => {
        response.on('finish', async () => {
          await this.container.shoutdown();
        });

        next();
      }
    );
  }
}
