/**
 * api.js
 *
 * Provides endpoints to the default Operaton REST API.
 *
 * Please refer to the `docs/Coding Conventions.md` "JavaScript > api.js" to
 * learn how we organize the code in this file.
 */

const _url = (state) => `${state.server.value.url}/engine-rest`

let headers = new Headers()
headers.set('Authorization', `Basic ${window.btoa(unescape(encodeURIComponent('demo:demo')))}`) //TODO authentication
let headers_json = headers
headers_json.set('Content-Type', 'application/json')

const get = (url, state, signal) =>
  fetch(`${_url(state)}${url}`)
    .then(response => response.json())
    .then(json => signal.value = json)

const post = (url, body, state, signl) =>
  fetch(`${_url(state)}${url}`,
    {
      headers: headers_json,
      method: 'POST',
      body: JSON.stringify(body)
    })
    .then(response => response.ok ? response.ok : Promise.reject(response))
    .then(result => signl.value = { success: true, ...result })
    .catch(response => response.json())
    .then(json => signl.value = { success: false, ...json })


export const get_user_profile = (state, user_name) => get(`/user/${user_name ?? 'demo'}/profile`, state, state.user_profile) // TODO remove `?? 'demo'` when we have working authentication
export const get_users = (state) => get('/user', state, state.users)
export const create_user = (state) => post('/user/create', state.user_create.value, state, state.user_create_response)
export const get_user_count = (state) => get('/user', state, state.user_count)
export const get_user_groups = (state, user_name) => post('/group', { member: user_name, firstResult: 0, maxResults: 50 }, state, state.user_groups)
export const get_process_definitions = (state) => get('/process-definition/statistics', state, state.process_definitions)
export const get_process_definition = (state, id) => get(`/process-definition/${id}`, state, state.process_definition)
export const get_process_instances = (state, definition_id) => get(`/history/process-instance?${url_params(definition_id)}`, state, state.process_instances)
export const get_process_incidents = (state, definition_id) => get(`/history/incident?processDefinitionId=${definition_id}`, state, state.process_incidents)
export const get_process_instance = (state, instance_id) => get(`/process-instance/${instance_id}`, state, state.process_instance)
export const get_process_instance_variables = (state, instance_id) => get(`/process-instance/${instance_id}/variables`, state, state.selection_values)
export const get_process_instance_incidents = (state, instance_id) => get(`/history/incident?processInstanceId=${instance_id}`, state, state.process_instance_incidents)
export const get_process_instance_tasks = (state, instance_id) => get(`/task?processInstanceId=${instance_id}`, state, state.process_instance_tasks)
export const get_called_process_instances = (state, instance_id) => get(`/process-instance?superProcessInstance=${instance_id}`, state, state.called_process_instances)
export const get_called_process_definitions = (state, definition_id) => get(`/process-definition/${definition_id}/static-called-process-definitions`, state, state.called_definitions)
export const get_job_definitions = (state, definition_id) => get(`/job-definition?processDefinitionId=${definition_id}`, state, state.job_definitions)
export const get_diagram = (state, definition_id) => get(`/process-definition/${definition_id}/xml`, state, state.process_definition_diagram)
export const get_task = (state, task_id) => get(`/task/${task_id}`, state, state.task)
export const get_task_rendered_form = (state, task_id) => get(`/task/${task_id}/rendered-form`, state, state.task_generated_form)
export const get_task_deployed_form = (state, task_id) => get(`/task/${task_id}/deployed-form`, state, state.task_deployed_form)
export const claim_task = (state, task_id) => post(`/task/${task_id}/claim`, { userId: state.user_profile.value.id }, state, state.task_claim_result)
export const unclaim_task = (state, task_id) => post(`/task/${task_id}/unclaim`, { userId: state.user_profile.value.id }, state, state.task_claim_result)
export const assign_task = (state, assignee, task_id) => post(`/task/${task_id}/assignee`, { userId: assignee }, state, state.task_assign_result)


/* return null or error message from server, in fact all validation should be done by HTML5 validation, but who knows ... */
export const post_task_form = (state, task_id, data) => {
  fetch(`${_url(state)}/task/${task_id}/submit-form`,
    {
      headers: headers_json,
      method: 'POST',
      body: JSON.stringify({ variables: data, withVariablesInReturn: true })
    })
    .then((response) => response.json())
    .then(json => {
      // if there is a json type, we get an error message back
      if (!json.type) {
        state.tasks.value = null
        // it's important that the form data is cleared before the task data, because the signal effect will be called immediately
        state.task_generated_form.value = null
        state.selected_task.value = null // the task is completed, so let it go
      } else {
        return json.message
      }
    })

  return null
}


export const get_tasks = (state, sort_key = 'name', sort_order = 'asc') =>
  fetch(`${_url(state)}/task?sortBy=${sort_key}&sortOrder=${sort_order}`, { headers })
    .then((response) => response.json())
    .then(json => {
      const definition_ids = [...new Set((json.map(task => task.processDefinitionId)))]

      // we need the process definition name for each task
      get_task_process_definitions(state, definition_ids)
        .then(defList => {
          const defMap = new Map() // helper map, mapping ID to process name
          defList.map(def => defMap.set(def.id, def))

          // set process name to task list
          json.forEach((task) => {
            const def = defMap.get(task.processDefinitionId)
            task.def_name = def ? def.name : ''
            task.def_version = def ? def.version : ''
          })

          state.tasks.value = json
        })
    })


// API call to enhance the data of the task list, no need for signal here
const get_task_process_definitions = (state, ids) =>
  fetch(`${_url(state)}/process-definition?processDefinitionIdIn=${ids}`, { headers })
    .then((response) => response.json())

// claim and unclaim tasks

const url_params = (definition_id) =>
  new URLSearchParams({
    unfinished: true,
    sortBy: 'startTime',
    sortOrder: 'asc',
    processDefinitionId: definition_id,
  }).toString()


// deployment endpoint
export const delete_deployment = (state, deployment_id, params = {}) => {
  const queryParams = new URLSearchParams(params).toString();

  fetch(`${_url(state)}/deployment/${deployment_id}?${queryParams}`, {
    headers: headers_json,
    method: 'DELETE',
  })
    .then((response) => {
      if (response.ok) {
        console.log(`Deployment ${deployment_id} deleted successfully.`);
        get_process_definitions(state)
      } else {
        return response.json().then((json) => {
          console.error(`Failed to delete deployment ${deployment_id}:`, json.message);
          return json.message;
        });
      }
    })
    .catch((error) => {
      console.error(`Error deleting deployment ${deployment_id}:`, error);
    });

  return null
}



// ######### DEPLOYMENTS API #########

/**
 * Fetches deployments sorted by deployment time, sets the first as selected
 * @sideeffects Updates `state.deployments`, triggers `get_deployment_resources`
 */
export const get_deployment = (state) => {
  return fetch(`${_url(state)}/deployment?sortBy=deploymentTime&sortOrder=desc`)
    .then((res) => res.json())
    .then((data) => {
      state.deployments.value = data;
      if (data?.length > 0) {
        state.selected_deployment.value = data[0];
        get_deployment_resources(state, data[0].id);
      }
    })
    .catch((error) => console.error("Error fetching deployments:", error));
};

/**
 * Fetches deployments
 * @returns {Promise<Array>} Raw deployment data
 */
export const get_deployment_v2 = (state) => {
  return fetch(`${_url(state)}/deployment?sortBy=deploymentTime&sortOrder=desc`)
    .then((res) => res.json());
};

/**
 * Fetches resources for a deployment and triggers BPMN diagram fetch
 * @sideeffects Updates `state.deployment_resources`, `state.selected_resource`
 */
export const get_deployment_resources = (state, deployment_id) => {
  return fetch(`${_url(state)}/deployment/${deployment_id}/resources`)
    .then((res) => res.json())
    .then((data) => {
      state.deployment_resources.value = data;
      if (data?.length > 0) {
        state.selected_resource.value = data[0];
        get_process_definition_by_deployment_id(state, deployment_id, data[0].name);
      }
    })
    .catch((error) => console.error("Error fetching resources:", error));
};

/**
 * Fetches BPMN 2.0 XML for a process definition
 * @param {Object} state - Application state
 * @param {string} process_definition_id - Process definition ID
 * @sideeffects Updates state.bpmn_xml
 */
export const get_process_definition_xml = (state, process_definition_id) => {
  return fetch(`${_url(state)}/process-definition/${process_definition_id}/xml`)
    .then((response) => response.json())
    .then((json) => (state.bpmn_xml.value = json.bpmn20Xml))
    .catch((error) => console.error("Error fetching BPMN XML:", error));
};

/**
 * Deletes a deployment and cleans up related state
 * @param {Object} state - Application state
 * @param {string} deployment_id - Deployment ID to delete
 * @param {Object} params - Optional query parameters
 * @sideeffects Resets deployment-related state values
 */
export const delete_deployment = (state, deployment_id, params = {}) => {
  const queryParams = new URLSearchParams(params).toString();

  return fetch(`${_url(state)}/deployment/${deployment_id}?${queryParams}`, {
    method: "DELETE",
  })
    .then((response) => {
      if (response.ok) {
        get_deployment(state);
        state.selected_deployment.value = null;
        state.deployment_resources.value = [];
        state.selected_resource.value = null;
        state.selected_process_statistics.value = null;
      } else {
        response.json().then((json) => {
          console.error(`Deletion failed: ${json.message}`);
        });
      }
    })
    .catch((error) => console.error("Error deleting deployment:", error));
};

/**
 * Counts running process instances for a deployment
 * @param {Object} state - Application state
 * @param {string} deployment_id - Deployment ID
 * @returns {Promise<number|null>} Instance count or null on error
 */
export const get_deployment_instance_count = (state, deployment_id) => {
  return fetch(`${_url(state)}/process-instance/count`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ deploymentId: deployment_id }),
  })
    .then((res) => {
      if (!res.ok) throw new Error("Count fetch failed");
      return res.json();
    })
    .catch((error) => {
      console.error("Error fetching instance count:", error);
      return null;
    });
};


/**
 * Fetches statistics and all details for a process definition
 * @param {Object} state - Application state
 * @param {string} process_definition_id - Process definition ID
 * @sideeffects Updates state.selected_process_statistics
 */
export const get_process_definition_statistics = (state, process_definition_id) => {
  return fetch(`${_url(state)}/process-definition/statistics`)
    .then((res) => res.json())
    .then((data) => {
      const filteredData = data.filter(
        (item) => item.definition.id === process_definition_id
      );
      state.selected_process_statistics.value = filteredData[0] || null;
    })
    .catch((error) => {
      console.error("Error fetching statistics:", error);
      state.selected_process_statistics.value = null;
    });
};

/**
 * Fetches process definition by deployment ID and resource name
 * @param {Object} state - Application state
 * @param {string} deployment_id - Deployment ID
 * @param {string} resource_name - Resource name
 * @sideeffects Triggers statistics fetch
 */
export const get_process_definition_by_deployment_id = (
  state,
  deployment_id,
  resource_name
) => {
  return fetch(
    `${_url(state)}/process-definition?deploymentId=${deployment_id}&resourceName=${encodeURIComponent(
      resource_name
    )}`
  )
    .then((res) => res.json())
    .then((data) => {
      if (data?.length > 0) {
        get_process_definition_statistics(state, data[0].id);
      }
    })
    .catch((error) => console.error("Error fetching process definition:", error));
};