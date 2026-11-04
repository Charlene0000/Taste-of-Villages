



export const getMapData = () => {
  return new Promise((resolve, reject) => {
    
    uni.request({
      url: '/static/map/china.json',
      method: 'GET',
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error('数据加载失败'));
        }
      },
      fail: (err) => {
        console.log('使用备用方案加载数据');
        
        const mockData = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                name: "广东省"
              },
              geometry: {
                type: "Polygon",
                coordinates: [[[113.5, 22.0], [114.0, 22.0], [114.0, 22.5], [113.5, 22.5], [113.5, 22.0]]]
              }
            }
          ]
        };
        resolve(mockData);
      }
    });
  });
};


export const getMockMapData = () => {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          name: "广东省"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[113.5, 22.0], [114.0, 22.0], [114.0, 22.5], [113.5, 22.5], [113.5, 22.0]]]
        }
      },
      {
        type: "Feature",
        properties: {
          name: "广西壮族自治区"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[108.0, 22.0], [109.0, 22.0], [109.0, 23.0], [108.0, 23.0], [108.0, 22.0]]]
        }
      },
      {
        type: "Feature",
        properties: {
          name: "福建省"
        },
        geometry: {
          type: "Polygon",
          coordinates: [[[117.0, 25.0], [118.0, 25.0], [118.0, 26.0], [117.0, 26.0], [117.0, 25.0]]]
        }
      }
    ]
  };
};
