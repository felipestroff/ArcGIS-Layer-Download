require([
    'esri/tasks/QueryTask',
    'esri/tasks/support/Query',
    'esri/tasks/Geoprocessor',
    'esri/request'
], function(
    QueryTask,
    Query,
    Geoprocessor,
    esriRequest
) {
    optionsBtn.addEventListener('click', function (e) {
        if (options.classList.contains('esri-feature-form__group--collapsed')) {
            options.classList.remove('esri-feature-form__group--collapsed');
            options.classList.add('esri-feature-form__group--active');
        }
        else {
            options.classList.remove('esri-feature-form__group--active');
            options.classList.add('esri-feature-form__group--collapsed');
        }

        e.preventDefault();
    });

    form.addEventListener('submit', function (e) {
        btn.classList.add('esri-button--disabled');
        btn.innerText = 'Loading...';

        errMessage.style.display = 'none';

        if (format.value === 'csv' ||
            format.value === 'xls') {
            convertSheet();
        }
        else if (format.value === 'geojson') {
            convertGeojson(); 
        }
        else {
            extractData();
        }

        e.preventDefault();
    });

    async function convertSheet() {
        const response = await queryLayer(false);
        console.log('Query results', response);

        var dataFormat, separator;
        if (format.value === 'csv') {
            dataFormat = 'data:text/csv';
            separator = ',';
        }
        else {
            dataFormat = 'data:application/vnd.ms-excel';
            separator = ';';
        }

        var sheetContent = '';

        response.fields.forEach(function (field) {
            sheetContent += field.alias + separator;
        });

        response.features.forEach(function (feature) {
            sheetContent += '\r\n';

            Object.values(feature.attributes).forEach(function (attr) {
                sheetContent += attr + separator;
            });
        });

        sheetContent = `${dataFormat};charset=utf-8,%EF%BB%BF ${encodeURIComponent(sheetContent)}`;

        const filename = setFileName();
        const ext = format.options[format.selectedIndex].dataset.ext;

        // Create link
        createFileLink(filename, sheetContent, ext);
    }

    async function convertGeojson() {
        const response = await queryLayer(true);
        console.log('Query results', response);

        const featureCollection = {
            type: 'FeatureCollection',
            features: response.features.map(f => Terraformer.ArcGIS.parse(f))
        };
        
        const filename = setFileName();
        const geojsonContent = `data:application/geo+json;charset=utf-8,%EF%BB%BF ${encodeURIComponent(JSON.stringify(featureCollection))}`;
        const ext = format.options[format.selectedIndex].dataset.ext;
        
        // Create link
        createFileLink(filename, geojsonContent, ext);
    }

    function extractData() {
        const inputLayers = [
            {
                url: serviceUrl.value,
                filter: filter.value
            }
        ];

        const filename = setFileName();
        const outputName = {
            itemProperties: {
                title: filename,
                tags: tags.value,
                snippet: `Original data: ${serviceUrl.value}`,
                description: 'Data exported from: <a href="https://github.com/felipestroff/ArcGIS-Layer-Download" target="_blank" rel="noreferrer">https://github.com/felipestroff/ArcGIS-Layer-Download</a>'
            }
        };

        const params = {
            inputLayers: JSON.stringify(inputLayers),
            outputName: JSON.stringify(outputName),
            dataFormat: format.value,
            f: 'json'
        };

        var geoprocessor = new Geoprocessor({
            url: 'https://analysis8.arcgis.com/arcgis/rest/services/tasks/GPServer/ExtractData',
            requestOptions: {
                query: {
                    f: 'json'
                }
            }
        });

        // Submit new job
        geoprocessor.submitJob(params).then(function(jobInfo) {
            console.log('Job info', jobInfo);
          
            var options = {
                interval: 1500,
                statusCallback: function(j) {
                    console.log('Job callback', j);
                    btn.innerText = 'Status: ' + j.jobStatus;
                }
            };
          
            // Wait for job done
            geoprocessor.waitForJobCompletion(jobInfo.jobId, options).then(function(jobComplete) {
                console.log('Job complete', jobComplete);

                // Request results
                esriRequest(`${geoprocessor.url}/jobs/${jobInfo.jobId}/results/contentID`, {
                    responseType: 'json',
                    query: {
                        f: 'json'
                    }
                })
                .then(function(jobResults) {
                    console.log('Job results', jobResults);

                    // Share item
                    btn.innerText = 'Status: sharing-item...';

                    esriRequest(jobResults.data.value.url + '/share', {
                        responseType: 'json',
                        method: 'post',
                        query: {
                            f: 'json',
                            groups: ' ',
                            confirmItemControl: true,
                            org: false,
                            everyone: true,
                        }
                    })
                    .then(function(shareResults) {
                        console.log('Share results', shareResults);

                        // Prepare item for download
                        const itemUrl = `${jobResults.data.value.url}/data`;
                        const ext = format.options[format.selectedIndex].dataset.ext;
                        const itemPortalUrl = shareResults.url.replace(
                            `/sharing/rest/content/items/${shareResults.data.itemId}/share`,
                            `/home/item.html?id=${shareResults.data.itemId}`
                        );
        
                        // Create link
                        createFileLink(filename, itemUrl, ext, itemPortalUrl);
                    })
                    .catch(function (e) {
                        handleException(e);
                    });
                })
                .catch(function (e) {
                    handleException(e);
                });
            })
            .catch(function (e) {
                handleException(e);
            });
        })
        .catch(function (e) {
            handleException(e);
        });
    }

    function queryLayer(geom) {
        return new Promise(function(resolve, reject) {
            const queryTask = new QueryTask({
                url: serviceUrl.value
            });
        
            const query = new Query();
            query.returnGeometry = geom;
            query.outFields = ['*'];
            query.where = filter.value ? filter.value : '1=1';
        
            queryTask.execute(query).then(function(queryResults) {
                resolve(queryResults);
            })
            .catch(function (e) {
                handleException(e);
            });
        });
    }

    function setFileName() {
        var name;
        const id = new Date().getTime();
        if (fileName.value) {
            name = `${fileName.value}`
        }
        else {
            name = `converted_${id}`;
        }
        return name;
    }

    function createFileLink(name, url, ext, portalUrl) {
        var externalUrl = '';
        if (portalUrl) {
            externalUrl =
            `<a rel="noreferrer" target="_blank" class="esri-widget__anchor esri-print__exported-file-link" href="${portalUrl}"
                style="display: inline; margin-left: 20px;">
                <span class="esri-icon-link-external"></span><span class="esri-print__exported-file-link-title">View item</span>
            </a>`;
        }

        files.innerHTML += 
        `<div class="esri-print__exported-file">
            <a download="${name}.${ext}" rel="noreferrer" target="_self" class="esri-widget__anchor esri-print__exported-file-link" href="${url}"
                style="display: inline; margin-right: 20px;">
                <span class="esri-icon-download"></span><span class="esri-print__exported-file-link-title">${name}.${ext}</span>
            </a>
            ${externalUrl}
        </div>`;

        files.style.display = 'block';

        btn.classList.remove('esri-button--disabled');
        btn.innerText = 'Convert';
    }

    function handleException(error) {
        console.log(error);

        btn.classList.remove('esri-button--disabled');
        btn.innerText = 'Convert';

        if (error.messages) {
            error.messages.forEach(function (e, i) {
                errMessage.innerHTML += `${i}. ${e.type}: ${e.description}<br>`;
            });
        }
        else {
            errMessage.innerHTML = `${error.name}:${error.message}<br>`;
        }

        errMessage.style.display = 'block'; 
    }
});