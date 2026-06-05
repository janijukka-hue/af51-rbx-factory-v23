# RBX Runtime Recovery

On failure:
- cleanup temp artifacts
- rollback incomplete exports
- invalidate partial manifests
- restore previous snapshot state

No partial export should survive pipeline failure.