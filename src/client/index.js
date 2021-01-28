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
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        if (format.value === 'csv' ||
            format.value === 'xls') {
            convertSheet();
        }
        else {
            extractData();
        }
    });

    function convertSheet() {
        btn.classList.add('esri-button--disabled');
        btn.innerText = 'Loading...';

        errMessage.style.display = 'none';

        const queryTask = new QueryTask({
            url: serviceUrl.value
        });
    
        const query = new Query();
        query.returnGeometry = false;
        query.outFields = ['*'];
        query.where = '1=1';
    
        queryTask.execute(query).then(function(queryResults) {
            console.log('Query results', queryResults);

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

            queryResults.fields.forEach(function (field) {
                sheetContent += field.alias + separator;
            });

            queryResults.features.forEach(function (feature) {
                sheetContent += '\r\n';

                Object.values(feature.attributes).forEach(function (attr) {
                    sheetContent += attr + separator;
                });
            });
    
            sheetContent = `${dataFormat};charset=utf-8,%EF%BB%BF ${encodeURIComponent(sheetContent)}`;

            const id = s4();

            const ext = format.options[format.selectedIndex].dataset.ext;
    
            files.innerHTML += 
            `<div aria-label="Abrir este" class="esri-print__exported-file">
                <a download="data_${id}.${ext}" rel="noreferrer" target="_self" class="esri-widget__anchor esri-print__exported-file-link" href="${sheetContent}">
                    <span class="esri-icon-download"></span><span class="esri-print__exported-file-link-title">data_${id}.${ext}</span>
                </a>
            </div>`;

            files.style.display = 'block';

            btn.classList.remove('esri-button--disabled');
            btn.innerText = 'Convert';
        })
        .catch(function (e) {
            handleException(e);
        });
    }

    function extractData() {
        btn.classList.add('esri-button--disabled');
        btn.innerText = 'Loading...';

        errMessage.style.display = 'none';

        const inputLayers = [
            {
                url: serviceUrl.value,
            }
        ];

        const id = s4();

        const outputName = {
            itemProperties: {
                title: `data_${id}`,
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
                    console.log('Job', j);

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
        
                        // Create link
                        files.innerHTML += 
                        `<div aria-label="Abrir este" class="esri-print__exported-file">
                            <a download="data_${id}.${ext}" rel="noreferrer" target="_self" class="esri-widget__anchor esri-print__exported-file-link" href="${itemUrl}">
                                <span class="esri-icon-download"></span><span class="esri-print__exported-file-link-title">data_${id}.${ext}</span>
                            </a>
                        </div>`;
    
                        files.style.display = 'block';
    
                        btn.classList.remove('esri-button--disabled');
                        btn.innerText = 'Convert';
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

    let s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
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
            errMessage.innerHTML = error.name + ': ' + error.message;
        }

        errMessage.style.display = 'block'; 
    }
});