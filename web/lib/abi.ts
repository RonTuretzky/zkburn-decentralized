// AUTO-GENERATED from contracts/src/ZKBurn.sol via `forge inspect ZKBurn abi`.
// Do not edit by hand — regenerate on any contract change.
export const zkburnAbi = [
  {
    "type": "constructor",
    "inputs": [
      {
        "name": "_verifier",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "_domain",
        "type": "string",
        "internalType": "string"
      },
      {
        "name": "_scope",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "MAX_VALIDITY",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "burn",
    "inputs": [
      {
        "name": "interactionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "note",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "checkStatus",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "exists",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "zkVerified",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "devMode",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "isBurned",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "burnCount",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "vouchCount",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "distinctBurners",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "distinctVouchers",
        "type": "uint32",
        "internalType": "uint32"
      },
      {
        "name": "lastBurnNote",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "confirmInteraction",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "domain",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBurns",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct ZKBurn.ActionRecord[]",
        "components": [
          {
            "name": "workerId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "interactionId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "retracted",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "note",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getInteraction",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct ZKBurn.Interaction",
        "components": [
          {
            "name": "workerId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "johnId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "proposedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "confirmedAt",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "burnUsed",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "vouchUsed",
            "type": "bool",
            "internalType": "bool"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getJohnInteractions",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getVouches",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple[]",
        "internalType": "struct ZKBurn.ActionRecord[]",
        "components": [
          {
            "name": "workerId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "interactionId",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "timestamp",
            "type": "uint64",
            "internalType": "uint64"
          },
          {
            "name": "retracted",
            "type": "bool",
            "internalType": "bool"
          },
          {
            "name": "note",
            "type": "string",
            "internalType": "string"
          }
        ]
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getWorkerInteractions",
    "inputs": [
      {
        "name": "workerId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256[]",
        "internalType": "uint256[]"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "idOf",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "identities",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "account",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "registeredAt",
        "type": "uint64",
        "internalType": "uint64"
      },
      {
        "name": "zkVerified",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "devMode",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "interactionCapabilities",
    "inputs": [
      {
        "name": "interactionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "caller",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "canBurn",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "canVouch",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "canRetractBurn",
        "type": "bool",
        "internalType": "bool"
      },
      {
        "name": "canRetractVouch",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "interactionCount",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "proposeInteraction",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "register",
    "inputs": [
      {
        "name": "params",
        "type": "tuple",
        "internalType": "struct ProofVerificationParams",
        "components": [
          {
            "name": "version",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "proofVerificationData",
            "type": "tuple",
            "internalType": "struct ProofVerificationData",
            "components": [
              {
                "name": "vkeyHash",
                "type": "bytes32",
                "internalType": "bytes32"
              },
              {
                "name": "proof",
                "type": "bytes",
                "internalType": "bytes"
              },
              {
                "name": "publicInputs",
                "type": "bytes32[]",
                "internalType": "bytes32[]"
              }
            ]
          },
          {
            "name": "committedInputs",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "serviceConfig",
            "type": "tuple",
            "internalType": "struct ServiceConfig",
            "components": [
              {
                "name": "validityPeriodInSeconds",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "domain",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "scope",
                "type": "string",
                "internalType": "string"
              },
              {
                "name": "devMode",
                "type": "bool",
                "internalType": "bool"
              }
            ]
          }
        ]
      }
    ],
    "outputs": [
      {
        "name": "id",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "retractBurn",
    "inputs": [
      {
        "name": "interactionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "retractVouch",
    "inputs": [
      {
        "name": "interactionId",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "scope",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "serviceScopeHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "serviceSubscopeHash",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "vouch",
    "inputs": [
      {
        "name": "interactionId",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "note",
        "type": "string",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "zkPassportVerifier",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "contract IZKPassportVerifier"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "BurnRetracted",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "workerId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "interactionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Burned",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "workerId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "interactionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "note",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "InteractionConfirmed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "johnId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "workerId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "InteractionProposed",
    "inputs": [
      {
        "name": "id",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "johnId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "workerId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "worker",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Registered",
    "inputs": [
      {
        "name": "id",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "account",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "zkVerified",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      },
      {
        "name": "devMode",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "VouchRetracted",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "workerId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "interactionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "Vouched",
    "inputs": [
      {
        "name": "johnId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "workerId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "interactionId",
        "type": "uint256",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "name": "note",
        "type": "string",
        "indexed": false,
        "internalType": "string"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AlreadyBound",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyConfirmed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "AlreadyRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "BurnAlreadyUsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "DomainMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidProof",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidPublicInputs",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotBurned",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotConfirmed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotJohn",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotRegistered",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotVouched",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotWorker",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NullifierMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ProofExpired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ScopeMismatch",
    "inputs": []
  },
  {
    "type": "error",
    "name": "SelfInteraction",
    "inputs": []
  },
  {
    "type": "error",
    "name": "UnknownJohn",
    "inputs": []
  },
  {
    "type": "error",
    "name": "VouchAlreadyUsed",
    "inputs": []
  }
] as const;
