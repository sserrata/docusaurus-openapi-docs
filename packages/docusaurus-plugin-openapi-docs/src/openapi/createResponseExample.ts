/* ============================================================================
 * Copyright (c) Palo Alto Networks
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * ========================================================================== */

import { sampleFromSchema } from "./createSchemaExample";
import { SchemaObject } from "./types";

export const sampleResponseFromSchema = (schema: SchemaObject = {}): any => {
  return sampleFromSchema(schema, { type: "response" });
};
