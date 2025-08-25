/* ============================================================================
 * Copyright (c) Palo Alto Networks
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 * ========================================================================== */

import { create } from "./utils";

export function createRequestHeader(header: string) {
  const id = header.replace(" ", "-").toLowerCase();
  return [
    create("Heading", {
      id,
      as: "h2",
      className: "openapi-tabs__heading",
      children: [
        `<Translate id="theme.RequestHeader.${id}">`,
        header,
        "</Translate>",
      ],
    }),
    `\n\n`,
  ];
}
