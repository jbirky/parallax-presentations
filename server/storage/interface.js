// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Jessica Birky

class StorageInterface {
  async listPresentations(userId) { throw new Error('Not implemented') }
  async getPresentation(id, userId) { throw new Error('Not implemented') }
  async createPresentation(data, userId) { throw new Error('Not implemented') }
  async updatePresentation(id, data, userId) { throw new Error('Not implemented') }
  async deletePresentation(id, userId) { throw new Error('Not implemented') }
  async duplicatePresentation(id, userId) { throw new Error('Not implemented') }

  async listTemplates(userId) { throw new Error('Not implemented') }
  async getTemplate(id, userId) { throw new Error('Not implemented') }
  async createTemplate(data, userId) { throw new Error('Not implemented') }
  async updateTemplate(id, data, userId) { throw new Error('Not implemented') }
  async deleteTemplate(id, userId) { throw new Error('Not implemented') }
  async saveAsTemplate(presentationId, title, userId) { throw new Error('Not implemented') }

  async createShareToken(presentationId, userId) { throw new Error('Not implemented') }
  async deleteShareToken(presentationId, userId) { throw new Error('Not implemented') }
  async getShareStatus(presentationId, userId) { throw new Error('Not implemented') }
  async getSharedPresentation(token) { throw new Error('Not implemented') }

  async createSnapshot(presentationId, name, userId) { throw new Error('Not implemented') }
  async listSnapshots(presentationId, userId) { throw new Error('Not implemented') }
  async restoreSnapshot(presentationId, snapshotId, userId) { throw new Error('Not implemented') }
  async deleteSnapshot(presentationId, snapshotId, userId) { throw new Error('Not implemented') }
  async getSnapshotData(presentationId, snapshotId, userId) { throw new Error('Not implemented') }

  async getGithubConfig(userId) { throw new Error('Not implemented') }
  async setGithubConfig(config, userId) { throw new Error('Not implemented') }
  async getZoteroConfig(userId) { throw new Error('Not implemented') }
  async setZoteroConfig(config, userId) { throw new Error('Not implemented') }

  async getZenodoConfig(userId) { throw new Error('Not implemented') }
  async setZenodoConfig(config, userId) { throw new Error('Not implemented') }

  async listPlugins() { throw new Error('Not implemented') }
  async getPlugin(slug) { throw new Error('Not implemented') }
  async installPlugin(pluginId, userId) { throw new Error('Not implemented') }
  async uninstallPlugin(pluginId, userId) { throw new Error('Not implemented') }
  async getInstalledPlugins(userId) { throw new Error('Not implemented') }
  async getPresentationPlugins(presentationId) { throw new Error('Not implemented') }
  async enablePluginForPresentation(presentationId, pluginId, config) { throw new Error('Not implemented') }
  async disablePluginForPresentation(presentationId, pluginId) { throw new Error('Not implemented') }
  async getPluginStorage(userId, pluginId, key) { throw new Error('Not implemented') }
  async setPluginStorage(userId, pluginId, key, value) { throw new Error('Not implemented') }
  async deletePluginStorage(userId, pluginId, key) { throw new Error('Not implemented') }

  async createDataset(data, userId) { throw new Error('Not implemented') }
  async listDatasets(userId) { throw new Error('Not implemented') }
  async getDataset(id, userId) { throw new Error('Not implemented') }
  async getDatasetByName(name, userId) { throw new Error('Not implemented') }
  async updateDataset(id, data, userId) { throw new Error('Not implemented') }
  async deleteDataset(id, userId) { throw new Error('Not implemented') }
  async linkDatasetToPresentation(presentationId, datasetId, alias) { throw new Error('Not implemented') }
  async unlinkDatasetFromPresentation(presentationId, datasetId) { throw new Error('Not implemented') }
  async getPresentationDatasets(presentationId) { throw new Error('Not implemented') }
  async createLiveDataset(data, userId) { throw new Error('Not implemented') }
  async getDatasetForFetch(id) { throw new Error('Not implemented') }
  async updateDatasetSource(id, userId, changes) { throw new Error('Not implemented') }
  async setDatasetTransforms(id, userId, transforms, outputColumns) { throw new Error('Not implemented') }
  async setOutputColumns(id, outputColumns) { throw new Error('Not implemented') }
  async countLiveDatasets(userId) { throw new Error('Not implemented') }
  async createDatasetVersion(datasetId, version) { throw new Error('Not implemented') }
  async setCurrentVersion(datasetId, version) { throw new Error('Not implemented') }
  async listDatasetVersions(datasetId) { throw new Error('Not implemented') }
  async getDatasetVersion(datasetId, versionId) { throw new Error('Not implemented') }
  async deleteDatasetVersions(datasetId, versionIds) { throw new Error('Not implemented') }
  async setPinnedVersion(presentationId, datasetId, versionId) { throw new Error('Not implemented') }
  async claimDueDatasets(limit, leaseSeconds) { throw new Error('Not implemented') }
  async leaseDataset(id, leaseSeconds) { throw new Error('Not implemented') }
  async recordFetchState(id, state) { throw new Error('Not implemented') }
  async recordFetch(datasetId, fetch) { throw new Error('Not implemented') }
  async listDatasetFetches(datasetId, limit) { throw new Error('Not implemented') }
  async pruneDatasetFetches(days) { throw new Error('Not implemented') }
}

module.exports = StorageInterface
