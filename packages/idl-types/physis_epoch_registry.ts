// AUTO-GENERATED FROM THE ANCHOR JSON IDL.
// Names are camel-cased to match Anchor's TypeScript runtime client.
// Regenerate this file after an on-chain IDL change.

export type PhysisEpochRegistry = {
  "address": "PHYcBRWd6mKATk3xo8oYi3d55BBHUc7kAN4kK91cJoE",
  "metadata": {
    "name": "physisEpochRegistry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Orrery: Physis Epoch Registry"
  },
  "instructions": [
    {
      "name": "activateEpoch",
      "discriminator": [
        174,
        221,
        4,
        21,
        20,
        159,
        175,
        138
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "registry.realm",
                "account": "epochRegistry"
              }
            ]
          }
        },
        {
          "name": "epoch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "account",
                "path": "epoch.epochId",
                "account": "physisEpoch"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "closeEpoch",
      "discriminator": [
        13,
        87,
        7,
        133,
        109,
        14,
        83,
        25
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "registry.realm",
                "account": "epochRegistry"
              }
            ]
          }
        },
        {
          "name": "epoch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "account",
                "path": "epoch.epochId",
                "account": "physisEpoch"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "initializeRegistry",
      "discriminator": [
        189,
        181,
        20,
        17,
        174,
        57,
        249,
        59
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "realm"
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "realm"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "physisYearStartMonth",
          "type": "u8"
        },
        {
          "name": "physisYearStartDay",
          "type": "u8"
        },
        {
          "name": "astralisEpochZeroTs",
          "type": "i64"
        },
        {
          "name": "astralisEpochDurationSeconds",
          "type": "i64"
        }
      ]
    },
    {
      "name": "pauseRegistry",
      "discriminator": [
        106,
        147,
        106,
        131,
        69,
        218,
        76,
        249
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "registry.realm",
                "account": "epochRegistry"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "registerEpoch",
      "discriminator": [
        106,
        91,
        145,
        117,
        116,
        61,
        155,
        111
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "registry.realm",
                "account": "epochRegistry"
              }
            ]
          }
        },
        {
          "name": "epoch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "arg",
                "path": "epochId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "epochId",
          "type": "u32"
        },
        {
          "name": "calendarYear",
          "type": "u16"
        },
        {
          "name": "calendarQuarter",
          "type": "u8"
        },
        {
          "name": "physisYear",
          "type": "u16"
        },
        {
          "name": "physisQuarter",
          "type": "u8"
        },
        {
          "name": "label",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "startTs",
          "type": "i64"
        },
        {
          "name": "endTs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "resumeRegistry",
      "discriminator": [
        214,
        222,
        128,
        181,
        158,
        27,
        118,
        208
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  104,
                  121,
                  115,
                  105,
                  115
                ]
              },
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104,
                  45,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "registry.realm",
                "account": "epochRegistry"
              }
            ]
          }
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "epochRegistry",
      "discriminator": [
        110,
        195,
        188,
        135,
        201,
        96,
        31,
        9
      ]
    },
    {
      "name": "physisEpoch",
      "discriminator": [
        247,
        10,
        221,
        83,
        71,
        102,
        222,
        121
      ]
    }
  ],
  "events": [
    {
      "name": "epochActivated",
      "discriminator": [
        12,
        247,
        190,
        39,
        196,
        178,
        156,
        85
      ]
    },
    {
      "name": "epochClosed",
      "discriminator": [
        21,
        4,
        48,
        56,
        29,
        169,
        77,
        42
      ]
    },
    {
      "name": "epochRegistered",
      "discriminator": [
        64,
        118,
        9,
        23,
        213,
        145,
        105,
        196
      ]
    },
    {
      "name": "registryInitialized",
      "discriminator": [
        144,
        138,
        62,
        105,
        58,
        38,
        100,
        177
      ]
    },
    {
      "name": "registryPaused",
      "discriminator": [
        187,
        60,
        205,
        238,
        36,
        219,
        148,
        187
      ]
    },
    {
      "name": "registryResumed",
      "discriminator": [
        230,
        212,
        119,
        17,
        235,
        202,
        104,
        244
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6001,
      "name": "registryPaused",
      "msg": "Registry is paused"
    },
    {
      "code": 6002,
      "name": "registryNotPaused",
      "msg": "Registry is not paused"
    },
    {
      "code": 6003,
      "name": "invalidPhysisYearStart",
      "msg": "Invalid Physis year start"
    },
    {
      "code": 6004,
      "name": "invalidAstralisEpochConfig",
      "msg": "Invalid ASTRALIS epoch configuration"
    },
    {
      "code": 6005,
      "name": "invalidEpochId",
      "msg": "Invalid epoch id"
    },
    {
      "code": 6006,
      "name": "invalidCalendarQuarter",
      "msg": "Invalid calendar quarter"
    },
    {
      "code": 6007,
      "name": "invalidPhysisQuarter",
      "msg": "Invalid Physis quarter"
    },
    {
      "code": 6008,
      "name": "invalidEpochTimestamps",
      "msg": "Invalid epoch timestamps"
    },
    {
      "code": 6009,
      "name": "epochNotPending",
      "msg": "Epoch is not pending"
    },
    {
      "code": 6010,
      "name": "epochNotActive",
      "msg": "Epoch is not active"
    },
    {
      "code": 6011,
      "name": "epochHasNotStarted",
      "msg": "Epoch has not started"
    },
    {
      "code": 6012,
      "name": "epochHasNotEnded",
      "msg": "Epoch has not ended"
    },
    {
      "code": 6013,
      "name": "activeEpochAlreadySet",
      "msg": "Another epoch is already active"
    },
    {
      "code": 6014,
      "name": "epochIsNotCurrent",
      "msg": "Epoch does not match current active epoch"
    },
    {
      "code": 6015,
      "name": "mathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "epochActivated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "epoch",
            "type": "pubkey"
          },
          {
            "name": "epochId",
            "type": "u32"
          },
          {
            "name": "activatedAtTs",
            "type": "i64"
          },
          {
            "name": "activatedAtSlot",
            "type": "u64"
          },
          {
            "name": "activatedAtSolanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "epochClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "epoch",
            "type": "pubkey"
          },
          {
            "name": "epochId",
            "type": "u32"
          },
          {
            "name": "closedAtTs",
            "type": "i64"
          },
          {
            "name": "closedAtSlot",
            "type": "u64"
          },
          {
            "name": "closedAtSolanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "epochRegistered",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "epoch",
            "type": "pubkey"
          },
          {
            "name": "epochId",
            "type": "u32"
          },
          {
            "name": "physisYear",
            "type": "u16"
          },
          {
            "name": "physisQuarter",
            "type": "u8"
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "endTs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "epochRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "realm",
            "type": "pubkey"
          },
          {
            "name": "physisYearStartMonth",
            "type": "u8"
          },
          {
            "name": "physisYearStartDay",
            "type": "u8"
          },
          {
            "name": "astralisEpochZeroTs",
            "type": "i64"
          },
          {
            "name": "astralisEpochDurationSeconds",
            "type": "i64"
          },
          {
            "name": "currentEpoch",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "latestClosedEpoch",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "physisEpoch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "epochId",
            "type": "u32"
          },
          {
            "name": "calendarYear",
            "type": "u16"
          },
          {
            "name": "calendarQuarter",
            "type": "u8"
          },
          {
            "name": "physisYear",
            "type": "u16"
          },
          {
            "name": "physisQuarter",
            "type": "u8"
          },
          {
            "name": "label",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "startTs",
            "type": "i64"
          },
          {
            "name": "endTs",
            "type": "i64"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "registeredAtTs",
            "type": "i64"
          },
          {
            "name": "registeredAtSlot",
            "type": "u64"
          },
          {
            "name": "registeredAtSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "activatedAtTs",
            "type": "i64"
          },
          {
            "name": "activatedAtSlot",
            "type": "u64"
          },
          {
            "name": "activatedAtSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "closedAtTs",
            "type": "i64"
          },
          {
            "name": "closedAtSlot",
            "type": "u64"
          },
          {
            "name": "closedAtSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "registryInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "realm",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "astralisEpochZeroTs",
            "type": "i64"
          },
          {
            "name": "astralisEpochDurationSeconds",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "registryPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "registryResumed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    }
  ]
};
