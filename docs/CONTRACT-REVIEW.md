# ZKBurn contract review — V1 → V2

Review of the deployed V1 (`0x772fA3dde14AAEeCD3c98E9b26E07a9afFfC46b4`) flows, and the changes made for the platform-grade V2.

## V1 flows (as deployed)

```
registerJohn(proof)              John binds nullifier → wallet
proposeInteraction(johnId)       ANY address proposes
confirmInteraction(id)           John's wallet consents
burn(johnId, note)               worker flags — scans ALL their interactions for a usable one
vouch(johnId, note)              worker vouches — same scan
checkStatus(johnId)              exists / burned / counts / last note
```

Mutual-consent gating is sound: a worker cannot burn without an interaction the John actively confirmed. That core safety property is preserved in V2. But several things are demo-grade:

### Findings

1. **Unbounded scan in `burn`/`vouch` (scalability + gas).**
   `_consumeInteraction` loops over *every* interaction the caller has ever proposed, across all Johns, to find one usable slot. A worker who has recorded many interactions pays ever-more gas, and can eventually hit the block gas limit — i.e. the action stops working. **Fix (also a simplification): actions take an explicit `interactionId`.** The one-per-interaction invariant is then enforced directly by a flag on that interaction — O(1), no loop, less code.

2. **Workers are anonymous addresses → no Sybil resistance.**
   Anyone can `proposeInteraction`; the only cost to fabricate "a different worker" is a fresh address. So "3 burns" could be one person from three addresses (each still needs the John to confirm, but a colluding/mistaken John, or a John who confirms routine interactions, enables inflation). **Fix: require the worker to be a registered identity too.** Every interaction is now between two zkPassport-unique humans, and reputation can report *distinct* burners/vouchers, not just raw counts.

3. **Reputation is thin.** `burnCount > 0 ⇒ burned` with no notion of *how many distinct people* flagged someone. One malicious burn looks identical to five independent ones. **Fix: track `distinctBurners` / `distinctVouchers`** so a checker can weigh "one flag" vs "a pattern."

4. **Burns are irreversible even by their own author.** A worker who flags the wrong ID, or reconciles with a client, cannot correct the record. Permanent false flags are a real harm vector on a safety platform. **Fix: `retractBurn` / `retractVouch`, callable only by the authoring worker.** Immutability of *other* people's records is untouched; the retraction is itself recorded (the history shows a burn was issued and later retracted), so nothing is silently erased.

5. **No self-interaction guard.** V1 lets an address proposing about its own JohnID through (harmless in practice, but sloppy). **Fix: `workerId != johnId`.**

6. **"Private note" was public.** The mock advertised private notes; on-chain they are public and immutable. V2 keeps notes public (that's inherent to a serverless, verifiable design) but labels them honestly and caps them. Encrypted off-chain notes referenced by hash are noted as future work.

### Deliberately kept

- **Two-tx propose/confirm (not EIP-712 signatures).** The app has no backend by design; the chain *is* the coordination channel between worker and John. A signature flow would need an off-chain channel to relay the John's signature back to the worker, reintroducing a server. Two on-chain txs is the correct trade for a serverless dapp.
- **Optimistic verification.** zkPassport's verifier still isn't on Gnosis; V2 keeps the auto-detecting verified/optimistic path unchanged.

## V2 flows

```
register(proof)                     role-agnostic; binds nullifier → wallet (John AND worker)
proposeInteraction(johnId)          worker (must be registered) proposes; stores workerId
confirmInteraction(id)              John consents
burn(interactionId, note)           O(1); one burn per interaction; updates distinct-burner set
vouch(interactionId, note)          O(1); symmetric
retractBurn(interactionId)          author-only; decrements active/distinct counts
retractVouch(interactionId)         author-only
checkStatus(johnId)                 exists / verified / burned / burnCount / vouchCount /
                                    distinctBurners / distinctVouchers / lastBurnNote
```

Net: one genuine simplification (the loop is gone), and four platform improvements (Sybil-resistant workers, distinct-party reputation, retraction, self-interaction guard) — without weakening the mutual-consent guarantee or the serverless/decentralized properties.
