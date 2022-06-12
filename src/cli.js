#!/usr/bin/env node

import { cli, error } from './index.js'

process.title = 'mmdc'
cli().catch((exception) => error(exception instanceof Error ? exception.stack : exception))
