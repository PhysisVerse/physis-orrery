/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/physis_eligibility_registry.json`.
 */
export type PhysisEligibilityRegistry = {
  "address": "PHYwVLxfos5STGcSzFe9Jirzy6YiEPPZC3wVKoTHoER",
  "metadata": {
    "name": "physisEligibilityRegistry",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Orrery: Physis Eligibility Registry"
  },
  "instructions": [
    {
      "name": "disableEligibilityClass",
      "discriminator": [
        214,
        124,
        92,
        80,
        124,
        132,
        77,
        149
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true
        },
        {
          "name": "eligibilityClass",
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
                  108,
                  105,
                  103,
                  105,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  45,
                  99,
                  108,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "arg",
                "path": "classId"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "classId",
          "type": "u32"
        }
      ]
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
          "name": "epochRegistry",
          "docs": [
            "Program 1-owned EpochRegistry for the supplied Realm."
          ]
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
                  108,
                  105,
                  103,
                  105,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
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
          "name": "governanceMode",
          "type": "u8"
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
          "writable": true
        }
      ],
      "args": []
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
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "revokeEligibilityRecord",
      "discriminator": [
        135,
        151,
        121,
        1,
        53,
        101,
        5,
        231
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true
        },
        {
          "name": "eligibilityClass",
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
                  108,
                  105,
                  103,
                  105,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  45,
                  99,
                  108,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "arg",
                "path": "classId"
              }
            ]
          }
        },
        {
          "name": "eligibilityRecord",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "classId",
          "type": "u32"
        },
        {
          "name": "subjectKind",
          "type": "u8"
        },
        {
          "name": "subjectKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "suspendEligibilityRecord",
      "discriminator": [
        83,
        206,
        203,
        36,
        62,
        104,
        174,
        177
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true
        },
        {
          "name": "eligibilityClass",
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
                  108,
                  105,
                  103,
                  105,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  45,
                  99,
                  108,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "arg",
                "path": "classId"
              }
            ]
          }
        },
        {
          "name": "eligibilityRecord",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "classId",
          "type": "u32"
        },
        {
          "name": "subjectKind",
          "type": "u8"
        },
        {
          "name": "subjectKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "transferRegistryAuthority",
      "discriminator": [
        9,
        135,
        35,
        32,
        93,
        150,
        65,
        9
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "registry",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "newAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "upsertEligibilityClass",
      "discriminator": [
        132,
        81,
        17,
        201,
        68,
        158,
        223,
        2
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
          "writable": true
        },
        {
          "name": "eligibilityClass",
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
                  108,
                  105,
                  103,
                  105,
                  98,
                  105,
                  108,
                  105,
                  116,
                  121,
                  45,
                  99,
                  108,
                  97,
                  115,
                  115
                ]
              },
              {
                "kind": "account",
                "path": "registry"
              },
              {
                "kind": "arg",
                "path": "classId"
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
          "name": "classId",
          "type": "u32"
        },
        {
          "name": "name",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
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
          "name": "kind",
          "type": "u8"
        },
        {
          "name": "status",
          "type": "u8"
        },
        {
          "name": "enabled",
          "type": "bool"
        },
        {
          "name": "governanceEligible",
          "type": "bool"
        },
        {
          "name": "rewardsEligible",
          "type": "bool"
        },
        {
          "name": "gateMint",
          "type": "pubkey"
        },
        {
          "name": "minAmount",
          "type": "u64"
        },
        {
          "name": "validFromEpochId",
          "type": "u32"
        },
        {
          "name": "validUntilEpochId",
          "type": "u32"
        }
      ]
    },
    {
      "name": "upsertEligibilityRecord",
      "discriminator": [
        17,
        244,
        44,
        221,
        223,
        28,
        219,
        255
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
          "writable": true
        },
        {
          "name": "eligibilityClass"
        },
        {
          "name": "eligibilityRecord",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "classId",
          "type": "u32"
        },
        {
          "name": "subjectKind",
          "type": "u8"
        },
        {
          "name": "subjectKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "wallet",
          "type": "pubkey"
        },
        {
          "name": "status",
          "type": "u8"
        },
        {
          "name": "source",
          "type": "u8"
        },
        {
          "name": "issuer",
          "type": "pubkey"
        },
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "validFromEpochId",
          "type": "u32"
        },
        {
          "name": "validUntilEpochId",
          "type": "u32"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "eligibilityClass",
      "discriminator": [
        86,
        72,
        205,
        146,
        238,
        2,
        82,
        39
      ]
    },
    {
      "name": "eligibilityRecord",
      "discriminator": [
        63,
        254,
        108,
        207,
        86,
        176,
        56,
        170
      ]
    },
    {
      "name": "eligibilityRegistry",
      "discriminator": [
        190,
        10,
        3,
        188,
        171,
        67,
        100,
        172
      ]
    }
  ],
  "events": [
    {
      "name": "eligibilityClassDisabled",
      "discriminator": [
        135,
        248,
        18,
        109,
        213,
        108,
        237,
        81
      ]
    },
    {
      "name": "eligibilityClassUpserted",
      "discriminator": [
        75,
        93,
        188,
        99,
        155,
        83,
        209,
        18
      ]
    },
    {
      "name": "eligibilityRecordRevoked",
      "discriminator": [
        69,
        0,
        0,
        176,
        69,
        95,
        4,
        250
      ]
    },
    {
      "name": "eligibilityRecordSuspended",
      "discriminator": [
        173,
        121,
        153,
        10,
        161,
        125,
        32,
        20
      ]
    },
    {
      "name": "eligibilityRecordUpserted",
      "discriminator": [
        237,
        106,
        146,
        51,
        112,
        89,
        105,
        216
      ]
    },
    {
      "name": "eligibilityRegistryAuthorityTransferred",
      "discriminator": [
        151,
        153,
        166,
        248,
        235,
        205,
        128,
        184
      ]
    },
    {
      "name": "eligibilityRegistryInitialized",
      "discriminator": [
        220,
        117,
        209,
        142,
        132,
        183,
        71,
        80
      ]
    },
    {
      "name": "eligibilityRegistryPaused",
      "discriminator": [
        165,
        69,
        167,
        148,
        156,
        177,
        140,
        140
      ]
    },
    {
      "name": "eligibilityRegistryResumed",
      "discriminator": [
        30,
        89,
        15,
        200,
        213,
        78,
        43,
        6
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "registryPaused",
      "msg": "Registry is paused"
    },
    {
      "code": 6001,
      "name": "registryNotPaused",
      "msg": "Registry is not paused"
    },
    {
      "code": 6002,
      "name": "invalidAuthority",
      "msg": "Invalid authority"
    },
    {
      "code": 6003,
      "name": "invalidGovernanceMode",
      "msg": "Invalid governance mode"
    },
    {
      "code": 6004,
      "name": "invalidClassKind",
      "msg": "Invalid eligibility class kind"
    },
    {
      "code": 6005,
      "name": "invalidClassStatus",
      "msg": "Invalid eligibility class status"
    },
    {
      "code": 6006,
      "name": "invalidRecordStatus",
      "msg": "Invalid eligibility record status"
    },
    {
      "code": 6007,
      "name": "invalidEligibilitySource",
      "msg": "Invalid eligibility source"
    },
    {
      "code": 6008,
      "name": "invalidSubjectKind",
      "msg": "Invalid subject kind"
    },
    {
      "code": 6009,
      "name": "invalidSubjectKey",
      "msg": "Invalid subject key"
    },
    {
      "code": 6010,
      "name": "invalidClassId",
      "msg": "Invalid class id"
    },
    {
      "code": 6011,
      "name": "invalidEpochWindow",
      "msg": "Invalid epoch window"
    },
    {
      "code": 6012,
      "name": "eligibilityClassDisabled",
      "msg": "Eligibility class is disabled"
    },
    {
      "code": 6013,
      "name": "classRegistryMismatch",
      "msg": "Eligibility class does not belong to this registry"
    },
    {
      "code": 6014,
      "name": "recordRegistryMismatch",
      "msg": "Eligibility record does not belong to this registry"
    },
    {
      "code": 6015,
      "name": "recordClassMismatch",
      "msg": "Eligibility record does not belong to this class"
    },
    {
      "code": 6016,
      "name": "walletSubjectMismatch",
      "msg": "Wallet does not match wallet subject key"
    },
    {
      "code": 6017,
      "name": "invalidNewAuthority",
      "msg": "New authority cannot be default pubkey"
    },
    {
      "code": 6018,
      "name": "eligibilityRecordNotSuspendable",
      "msg": "Eligibility record cannot be suspended from its current status"
    },
    {
      "code": 6019,
      "name": "eligibilityRecordAlreadyRevoked",
      "msg": "Eligibility record is already revoked"
    },
    {
      "code": 6020,
      "name": "classIdKindMismatch",
      "msg": "Eligibility class id does not match its class kind"
    },
    {
      "code": 6021,
      "name": "invalidClassState",
      "msg": "Eligibility class status and enabled state are inconsistent"
    },
    {
      "code": 6022,
      "name": "invalidEpochRegistry",
      "msg": "Epoch registry is not the canonical Program 1 registry for this Realm"
    },
    {
      "code": 6023,
      "name": "epochRegistryNotInitialized",
      "msg": "Program 1 Epoch Registry account does not exist or is not initialized"
    },
    {
      "code": 6024,
      "name": "invalidEpochRegistryOwner",
      "msg": "Program 1 Epoch Registry has an invalid account owner"
    },
    {
      "code": 6025,
      "name": "invalidEpochRegistryDiscriminator",
      "msg": "Program 1 Epoch Registry has an invalid account discriminator"
    },
    {
      "code": 6026,
      "name": "invalidEpochRegistryVersion",
      "msg": "Program 1 Epoch Registry uses an unsupported version"
    },
    {
      "code": 6027,
      "name": "epochRegistryRealmMismatch",
      "msg": "Program 1 Epoch Registry belongs to a different Realm"
    },
    {
      "code": 6028,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6029,
      "name": "eligibilitySourceClassMismatch",
      "msg": "Eligibility source is not permitted for this eligibility class"
    }
  ],
  "types": [
    {
      "name": "eligibilityClass",
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
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "name",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
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
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "governanceEligible",
            "type": "bool"
          },
          {
            "name": "rewardsEligible",
            "type": "bool"
          },
          {
            "name": "gateMint",
            "type": "pubkey"
          },
          {
            "name": "minAmount",
            "type": "u64"
          },
          {
            "name": "validFromEpochId",
            "type": "u32"
          },
          {
            "name": "validUntilEpochId",
            "type": "u32"
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "createdSlot",
            "type": "u64"
          },
          {
            "name": "createdSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "updatedTs",
            "type": "i64"
          },
          {
            "name": "updatedSlot",
            "type": "u64"
          },
          {
            "name": "updatedSolanaEpoch",
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
                128
              ]
            }
          }
        ]
      }
    },
    {
      "name": "eligibilityClassDisabled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "eligibilityClass",
            "type": "pubkey"
          },
          {
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityClassUpserted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "eligibilityClass",
            "type": "pubkey"
          },
          {
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "kind",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "enabled",
            "type": "bool"
          },
          {
            "name": "governanceEligible",
            "type": "bool"
          },
          {
            "name": "rewardsEligible",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRecord",
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
            "name": "eligibilityClass",
            "type": "pubkey"
          },
          {
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "subjectKind",
            "type": "u8"
          },
          {
            "name": "subjectKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "source",
            "type": "u8"
          },
          {
            "name": "issuer",
            "type": "pubkey"
          },
          {
            "name": "metadataHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "validFromEpochId",
            "type": "u32"
          },
          {
            "name": "validUntilEpochId",
            "type": "u32"
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "createdSlot",
            "type": "u64"
          },
          {
            "name": "createdSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "updatedTs",
            "type": "i64"
          },
          {
            "name": "updatedSlot",
            "type": "u64"
          },
          {
            "name": "updatedSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "evidenceIssuedAt",
            "type": "i64"
          },
          {
            "name": "evidenceExpiresAt",
            "type": "i64"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                112
              ]
            }
          }
        ]
      }
    },
    {
      "name": "eligibilityRecordRevoked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "eligibilityClass",
            "type": "pubkey"
          },
          {
            "name": "eligibilityRecord",
            "type": "pubkey"
          },
          {
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "subjectKind",
            "type": "u8"
          },
          {
            "name": "subjectKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRecordSuspended",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "eligibilityClass",
            "type": "pubkey"
          },
          {
            "name": "eligibilityRecord",
            "type": "pubkey"
          },
          {
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "subjectKind",
            "type": "u8"
          },
          {
            "name": "subjectKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRecordUpserted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "eligibilityClass",
            "type": "pubkey"
          },
          {
            "name": "eligibilityRecord",
            "type": "pubkey"
          },
          {
            "name": "classId",
            "type": "u32"
          },
          {
            "name": "subjectKind",
            "type": "u8"
          },
          {
            "name": "subjectKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "source",
            "type": "u8"
          },
          {
            "name": "validFromEpochId",
            "type": "u32"
          },
          {
            "name": "validUntilEpochId",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRegistry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
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
            "name": "epochRegistry",
            "type": "pubkey"
          },
          {
            "name": "governanceMode",
            "type": "u8"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "classCount",
            "type": "u32"
          },
          {
            "name": "recordCount",
            "type": "u64"
          },
          {
            "name": "createdTs",
            "type": "i64"
          },
          {
            "name": "createdSlot",
            "type": "u64"
          },
          {
            "name": "createdSolanaEpoch",
            "type": "u64"
          },
          {
            "name": "updatedTs",
            "type": "i64"
          },
          {
            "name": "updatedSlot",
            "type": "u64"
          },
          {
            "name": "updatedSolanaEpoch",
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
                128
              ]
            }
          }
        ]
      }
    },
    {
      "name": "eligibilityRegistryAuthorityTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "registry",
            "type": "pubkey"
          },
          {
            "name": "oldAuthority",
            "type": "pubkey"
          },
          {
            "name": "newAuthority",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRegistryInitialized",
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
            "name": "epochRegistry",
            "type": "pubkey"
          },
          {
            "name": "governanceMode",
            "type": "u8"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRegistryPaused",
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
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "eligibilityRegistryResumed",
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
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "slot",
            "type": "u64"
          },
          {
            "name": "solanaEpoch",
            "type": "u64"
          }
        ]
      }
    }
  ]
};

