import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s',
};

const targetUrl = __ENV.TARGET_URL || 'http://service:3000/';

export default function () {
  http.get(targetUrl);
  sleep(1);
}
