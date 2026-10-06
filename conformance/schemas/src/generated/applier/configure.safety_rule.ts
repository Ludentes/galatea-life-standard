/* Generated from conformance/schemas/applier/configure.safety_rule.json by scripts/gen-types.ts. Do not edit. */

export interface ApplierConfigureSafetyRule {
  id: string;
  trigger:
    | {
        device: string;
        key: string;
        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
        value: string | number | boolean;
      }
    | {
        /**
         * @minItems 1
         * @maxItems 32
         */
        all: [
          (
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          ),
          ...(
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          )[]
        ];
      }
    | {
        /**
         * @minItems 1
         * @maxItems 32
         */
        any: [
          (
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          ),
          ...(
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          )[]
        ];
      };
  conditions?:
    | {
        device: string;
        key: string;
        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
        value: string | number | boolean;
      }
    | {
        /**
         * @minItems 1
         * @maxItems 32
         */
        all: [
          (
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          ),
          ...(
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          )[]
        ];
      }
    | {
        /**
         * @minItems 1
         * @maxItems 32
         */
        any: [
          (
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          ),
          ...(
            | {
                device: string;
                key: string;
                op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                value: string | number | boolean;
              }
            | (
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    all: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
                | {
                    /**
                     * @minItems 1
                     * @maxItems 32
                     */
                    any: [
                      {
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      },
                      ...{
                        device: string;
                        key: string;
                        op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                        value: string | number | boolean;
                      }[]
                    ];
                  }
              )
          )[]
        ];
      };
  /**
   * @minItems 1
   * @maxItems 16
   */
  actions:
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ]
    | [
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        },
        {
          target: string;
          action: string;
          args?: {
            [k: string]: unknown | undefined;
          };
        }
      ];
  latch?: {
    condition:
      | {
          device: string;
          key: string;
          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
          value: string | number | boolean;
        }
      | {
          /**
           * @minItems 1
           * @maxItems 32
           */
          all: [
            (
              | {
                  device: string;
                  key: string;
                  op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                  value: string | number | boolean;
                }
              | (
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      all: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      any: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                )
            ),
            ...(
              | {
                  device: string;
                  key: string;
                  op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                  value: string | number | boolean;
                }
              | (
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      all: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      any: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                )
            )[]
          ];
        }
      | {
          /**
           * @minItems 1
           * @maxItems 32
           */
          any: [
            (
              | {
                  device: string;
                  key: string;
                  op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                  value: string | number | boolean;
                }
              | (
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      all: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      any: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                )
            ),
            ...(
              | {
                  device: string;
                  key: string;
                  op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                  value: string | number | boolean;
                }
              | (
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      all: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                  | {
                      /**
                       * @minItems 1
                       * @maxItems 32
                       */
                      any: [
                        {
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        },
                        ...{
                          device: string;
                          key: string;
                          op: "eq" | "ne" | "lt" | "le" | "gt" | "ge";
                          value: string | number | boolean;
                        }[]
                      ];
                    }
                )
            )[]
          ];
        };
  };
  notice?: {
    text: string;
  };
  accepts_other_admins?: boolean;
}
