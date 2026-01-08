import { lastValueFrom } from 'rxjs';

import { config } from '@grafana/runtime';
import { DataSourceSettings, DataSourceJsonData } from '@grafana/data';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { accessControlQueryParam } from 'app/core/utils/accessControl';

export const getDataSources = async (): Promise<DataSourceSettings[]> => {
  return await getBackendSrv().get('/api/datasources');
};

export interface K8sMetadata {
  name: string;
  namespace: string;
  uid: string;
  resourceVersion: string;
  generation: number;
  creationTimestamp: string;
  labels: Object,
  annotations: Object,
}

export interface DatasourceInstanceK8sSpec {
  access: string;
  jsonData: DataSourceJsonData,
  title: string;
}

export interface DataSourceSettingsK8s {
  kind: string;
  apiVersion: string;
  metadata: K8sMetadata;
  spec: DatasourceInstanceK8sSpec;
}

/**
 * @deprecated Use `getDataSourceByUid` instead.
 */
export const getDataSourceById = async (id: string) => {
  const response = await lastValueFrom(
    getBackendSrv().fetch<DataSourceSettings>({
      method: 'GET',
      url: `/api/datasources/${id}`,
      params: accessControlQueryParam(),
      showErrorAlert: false,
    })
  );

  if (response.ok) {
    return response.data;
  }

  throw Error(`Could not find data source by ID: "${id}"`);
};

export const getDataSourceByK8sGroupVersionName = async (k8sGroup: string, k8sVersion: string, k8sName: string, stackId: string) => {
  console.log("using", k8sGroup, k8sVersion, k8sName, stackId);
  const response = await lastValueFrom(
    getBackendSrv().fetch<DataSourceSettingsK8s>({
      method: 'GET',
      url: `/apis/${k8sGroup}/${k8sVersion}/namespaces/${stackId}/datasources/${k8sName}`,
      params: accessControlQueryParam(),
      showErrorAlert: false,
    })
  );

  if (!response.ok) {
    throw Error(`Could not find data source by group-version-name: "${k8sGroup}" "${k8sVersion}" "${k8sName}"`);
  }
  let dsK8sSettings = response.data;
  let id = parseInt(dsK8sSettings.metadata.labels["grafana.app/deprecatedInternalID"] || "", 10);
  let dsSettings: DataSourceSettings = {
    id: id,
    uid: dsK8sSettings.metadata.name,
    orgId: 0,
    name: "",
    typeLogoUrl: "",
    type: "",
    typeName: "",
    access: "",
    url: "",
    user: "",
    database: "",
    basicAuth: false,
    basicAuthUser: "",
    isDefault: true,
    jsonData: dsK8sSettings.spec.jsonData,
    secureJsonFields: {},
    readOnly: false,
    withCredentials: false,
  };
  console.log(dsSettings);
  return dsSettings;
};

export const getDataSourceByUid = async (uid: string) => {
  const response = await lastValueFrom(
    getBackendSrv().fetch<DataSourceSettings>({
      method: 'GET',
      url: `/api/datasources/uid/${uid}`,
      params: accessControlQueryParam(),
      showErrorAlert: false,
    })
  );

  if (response.ok) {
    return response.data;
  }

  throw Error(`Could not find data source by UID: "${uid}"`);
};

export const getDataSourceByIdOrUid = async (idOrUid: string) => {
  if (config.featureToggles.queryServiceWithConnections) {
    var k8sGroup = "prometheus.datasource.grafana.app";
    var k8sVersion = "v0alpha1";
    var stackId = "default";
    return getDataSourceByK8sGroupVersionName(k8sGroup, k8sVersion, idOrUid, stackId);
  }

  // Try with UID first, as we are trying to migrate to that
  try {
    return await getDataSourceByUid(idOrUid);
  } catch (err) {
    console.log(`Failed to lookup data source using UID "${idOrUid}"`);
  }

  // Try using ID
  try {
    return await getDataSourceById(idOrUid);
  } catch (err) {
    console.log(`Failed to lookup data source using ID "${idOrUid}"`);
  }

  throw Error('Could not find data source');
};

export const createDataSource = (dataSource: Partial<DataSourceSettings>) =>
  getBackendSrv().post('/api/datasources', dataSource);

export const getDataSourcePlugins = () => getBackendSrv().get('/api/plugins', { enabled: 1, type: 'datasource' });

export const updateDataSource = (dataSource: DataSourceSettings) => {
  // we're setting showErrorAlert and showSuccessAlert to false to suppress the popover notifications. Request result will now be
  // handled by the data source config page
  return getBackendSrv().put(`/api/datasources/uid/${dataSource.uid}`, dataSource, {
    showErrorAlert: false,
    showSuccessAlert: false,
    validatePath: true,
  });
};

export const deleteDataSource = (uid: string) => getBackendSrv().delete(`/api/datasources/uid/${uid}`);
