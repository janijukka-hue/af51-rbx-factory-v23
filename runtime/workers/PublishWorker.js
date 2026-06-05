export class PublishWorker {
  async run({ validated, zip }) {
    if (!validated.valid) {
      throw new Error('PUBLISH_BLOCKED');
    }

    return {
      published: true,
      artifact: zip.artifact
    };
  }
}